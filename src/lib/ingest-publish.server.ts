import { admin } from "@/lib/ingest.server";
import { usableImage } from "@/lib/story-image";
import { classifyForPublish } from "@/lib/classify-at-publish.server";

/**
 * Publishes reviewed raw items as public digest cards.
 *
 * Attribution is mandatory: the publisher name, the original URL and the
 * original publication date always travel with the card, and only our own
 * concise summary is stored — never the full third-party article.
 *
 * The write path is batched: one cluster read, one insert, two status updates
 * and one counter call for the whole run, instead of five round trips per row.
 */
export async function publishRawItems(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const db = await admin();
  const { data: rows, error } = await db
    .from("raw_ingestion_items")
    .select("*")
    .in("id", ids);
  if (error) throw new Error(error.message);

  const all = (rows ?? []) as Record<string, any>[];

  // Editorial rule: a news card without artwork is not published at all.
  // Calendar items (events) are exempt — they are notices, not photo stories.
  const rejected: Record<string, any>[] = [];
  const candidates: Record<string, any>[] = [];
  for (const row of all) {
    if (!row["event_start"] && !usableImage(row["image_url"])) rejected.push(row);
    else candidates.push(row);
  }

  // Automatic duplicate rejection before anything is written: normalised title,
  // canonical URL or >=85% body similarity against what the site already holds.
  const { guardArticle } = await import("@/lib/duplicate-guard.server");
  const publishable: Record<string, any>[] = [];
  const duplicates: { row: Record<string, any>; contentId: string }[] = [];
  for (const row of candidates) {
    const guard = await guardArticle(db as never, {
      title: row["digest_headline"] || row["original_title"],
      link_url: row["canonical_url"],
      body: row["what_happened"] || row["excerpt"],
      image_url: row["image_url"],
      dedupe_key: row["dedupe_key"],
      source: row["source_name"],
      entry_point: "raw-ingest",
    });
    if (guard.duplicate) {
      console.log(
        `[dedupe] rejected ${guard.hit.reason} score=${guard.hit.score} original=${guard.hit.id} ` +
          `source="${row["source_name"]}" title="${row["digest_headline"] || row["original_title"]}" ` +
          `url=${row["canonical_url"]}`,
      );
      duplicates.push({ row, contentId: guard.hit.id });
    }
    else publishable.push(row);
  }

  if (rejected.length) {
    // dedupe_status is an enum, so the reason lives on the row's own status:
    // writing a free-text value here silently failed and left rows stuck.
    await db
      .from("raw_ingestion_items")
      .update({ processing_status: "rejected" })
      .in(
        "id",
        rejected.map((r) => r["id"]),
      );
  }

  if (duplicates.length) {
    // Silently retired, pointed at the story already on the site.
    await Promise.all(
      duplicates.map(({ row, contentId }) =>
        db
          .from("raw_ingestion_items")
          .update({
            processing_status: "duplicate",
            dedupe_status: "duplicate",
            published_content_item_id: contentId,
          })
          .eq("id", row["id"]),
      ),
    );
  }
  if (!publishable.length) return 0;


  // Cluster attribution for the whole batch in one read.
  const clusterIds = [
    ...new Set(publishable.map((r) => r["story_cluster_id"]).filter(Boolean)),
  ] as string[];
  const clusterNames = new Map<string, string[] | undefined>();
  if (clusterIds.length) {
    const { data: clusters } = await db
      .from("story_clusters")
      .select("id, source_names")
      .in("id", clusterIds);
    for (const c of (clusters ?? []) as { id: string; source_names?: string[] }[]) {
      clusterNames.set(c.id, c.source_names);
    }
  }

  const publishedAt = new Date().toISOString();
  const payloadOf = (row: Record<string, any>) => {
    // Section + local flag are decided once here so reader queries stay small
    // indexed lookups instead of re-classifying hundreds of rows.
    const classified = classifyForPublish({
      title: row["digest_headline"] || row["original_title"],
      summary: row["what_happened"] || row["excerpt"],
      link_url: row["canonical_url"],
      city: row["city"],
      category: row["topic"],
    });
    return {
      ...classified,
      source: "ingest",
      source_ref: row["canonical_url"],
      kind: row["event_start"] ? "event" : "news",
      status: "published",
      placement: "auto",
      title: row["digest_headline"] || row["original_title"],
      summary: row["what_happened"] || row["excerpt"],
      image_url: row["image_url"],
      link_url: row["canonical_url"],
      city: row["city"],
      category: row["topic"],
      event_start: row["event_start"],
      dedupe_key: row["dedupe_key"],
      published_at: publishedAt,
      source_id: row["source_id"],
      story_cluster_id: row["story_cluster_id"],
      content_label: row["source_id"] ? "aggregated" : "original",
      confidence: null,
      priority_score: row["priority_score"],
      why_it_matters: row["why_it_matters"],
      what_to_do: row["what_to_do"],
      source_names: clusterNames.get(row["story_cluster_id"]) ?? [row["source_name"]],
      ai_generated_at: row["ai_generated_at"],
    };
  };

  // `source_ref` is unique, so a batch that repeats a URL (or re-publishes one
  // already stored) would fail as a whole. Collapse repeats inside the batch and
  // fall back to per-row inserts when the bulk write is refused, so a single
  // conflicting row can never drop the rest of the run.
  const bySourceRef = new Map<string, Record<string, any>>();
  const noRef: Record<string, any>[] = [];
  for (const row of publishable) {
    const ref = row["canonical_url"];
    if (!ref) noRef.push(row);
    else if (!bySourceRef.has(ref)) bySourceRef.set(ref, row);
  }
  const batch = [...bySourceRef.values(), ...noRef];

  type Inserted = { id: string; source_ref: string | null };
  const insertedFor = new Map<string, string>(); // raw id -> content item id
  const publishedRows: Record<string, any>[] = [];

  const { data: insertedData, error: insertError } = await db
    .from("content_items")
    .insert(batch.map(payloadOf))
    .select("id, source_ref");

  if (!insertError) {
    const byRef = new Map<string, string>();
    const anonymous: string[] = [];
    for (const r of (insertedData ?? []) as Inserted[]) {
      if (r.source_ref) byRef.set(r.source_ref, r.id);
      else anonymous.push(r.id);
    }
    for (const row of batch) {
      const ref = row["canonical_url"];
      const hit = ref ? byRef.get(ref) : anonymous.shift();
      publishedRows.push(row);
      if (hit) insertedFor.set(row["id"], hit);
    }
  } else {
    // Per-row retry preserves the previous behaviour: failing rows are skipped.
    for (const row of batch) {
      const { data: one, error: oneError } = await db
        .from("content_items")
        .insert(payloadOf(row))
        .select("id")
        .maybeSingle();
      if (oneError) continue;
      publishedRows.push(row);
      const id = (one as { id: string } | null)?.id;
      if (id) insertedFor.set(row["id"], id);
    }
  }

  if (!publishedRows.length) return 0;

  // Rows whose content id is known are stamped in groups; anything unmatched
  // still gets its status, just without a back-reference.
  const byContentId = new Map<string, string[]>();
  const unmatched: string[] = [];
  for (const row of publishedRows) {
    const contentId = insertedFor.get(row["id"]);
    if (!contentId) unmatched.push(row["id"]);
    else byContentId.set(contentId, [...(byContentId.get(contentId) ?? []), row["id"]]);
  }
  await Promise.all([
    ...[...byContentId.entries()].map(([contentId, rawIds]) =>
      db
        .from("raw_ingestion_items")
        .update({ processing_status: "published", published_content_item_id: contentId })
        .in("id", rawIds),
    ),
    unmatched.length
      ? db
          .from("raw_ingestion_items")
          .update({ processing_status: "published", published_content_item_id: null })
          .in("id", unmatched)
      : null,
  ]);

  // One atomic counter bump for the whole run: the old read-then-write lost
  // increments whenever two hook runs overlapped.
  const sourceIds = publishedRows.map((r) => r["source_id"]).filter(Boolean) as string[];
  if (sourceIds.length) {
    await db.rpc("increment_items_published", { source_ids: sourceIds });
  }

  // Keep the digest's read table in step with this publish path too — a mirror
  // failure must never undo a successful publish, so it stays best-effort.
  const contentIds = [...insertedFor.values()];
  if (contentIds.length) {
    try {
      const { data: stored } = await db
        .from("content_items")
        .select("*")
        .in("id", contentIds);
      if (stored?.length) {
        const { mirrorToArticles } = await import("@/lib/articles-mirror.server");
        await mirrorToArticles(db as never, stored as never);
      }
    } catch (error) {
      console.error("articles mirror failed (ingest publish)", error);
    }
  }

  return publishedRows.length;
}

