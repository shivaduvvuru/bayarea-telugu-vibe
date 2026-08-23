import { admin } from "@/lib/ingest.server";
import { usableImage } from "@/lib/story-image";
import { classifyForPublish } from "@/lib/classify-at-publish.server";

/**
 * Publishes reviewed raw items as public digest cards.
 *
 * Attribution is mandatory: the publisher name, the original URL and the
 * original publication date always travel with the card, and only our own
 * concise summary is stored — never the full third-party article.
 */
export async function publishRawItems(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const db = await admin();
  const { data: rows, error } = await db
    .from("raw_ingestion_items")
    .select("*")
    .in("id", ids);
  if (error) throw new Error(error.message);

  let published = 0;
  for (const row of (rows ?? []) as Record<string, any>[]) {
    // Editorial rule: a news card without artwork is not published at all.
    // Calendar items (events) are exempt — they are notices, not photo stories.
    if (!row["event_start"] && !usableImage(row["image_url"])) {
      await db
        .from("raw_ingestion_items")
        .update({ processing_status: "rejected", dedupe_status: "no-image" })
        .eq("id", row["id"]);
      continue;
    }
    const cluster = row["story_cluster_id"]
      ? (
          await db
            .from("story_clusters")
            .select("source_names")
            .eq("id", row["story_cluster_id"])
            .maybeSingle()
        ).data
      : null;

    // Section + local flag are decided once here so reader queries stay small
    // indexed lookups instead of re-classifying hundreds of rows.
    const classified = classifyForPublish({
      title: row["digest_headline"] || row["original_title"],
      summary: row["what_happened"] || row["excerpt"],
      link_url: row["canonical_url"],
      city: row["city"],
      category: row["topic"],
    });

    const payload = {
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
      published_at: new Date().toISOString(),
      source_id: row["source_id"],
      story_cluster_id: row["story_cluster_id"],
      content_label: row["source_id"] ? "aggregated" : "original",
      confidence: null,
      priority_score: row["priority_score"],
      why_it_matters: row["why_it_matters"],
      what_to_do: row["what_to_do"],
      source_names:
        (cluster as { source_names?: string[] } | null)?.source_names ?? [row["source_name"]],
      ai_generated_at: row["ai_generated_at"],
    };

    const { data: inserted, error: insertError } = await db
      .from("content_items")
      .insert(payload)
      .select("id")
      .maybeSingle();
    if (insertError) continue;

    published += 1;
    await db
      .from("raw_ingestion_items")
      .update({
        processing_status: "published",
        published_content_item_id: (inserted as { id: string } | null)?.id ?? null,
      })
      .eq("id", row["id"]);
    if (row["source_id"]) {
      const { data: source } = await db
        .from("content_sources")
        .select("items_published")
        .eq("id", row["source_id"])
        .maybeSingle();
      await db
        .from("content_sources")
        .update({ items_published: ((source as { items_published?: number } | null)?.items_published ?? 0) + 1 })
        .eq("id", row["source_id"]);
    }
  }
  return published;
}
