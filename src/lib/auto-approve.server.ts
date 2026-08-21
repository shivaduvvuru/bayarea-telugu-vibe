import { admin } from "@/lib/ingest.server";

type PendingRow = {
  id: string;
  dedupe_key: string | null;
  canonical_url: string | null;
  original_title: string | null;
  dedupe_status: string | null;
  priority_score: number | null;
};

const PENDING_STATES = ["new", "needs_review", "recommended", "approved"] as const;

/**
 * The news review queue approves itself.
 *
 * Editorial policy: nothing waits for a human decision any more. Every freshly
 * collected item is first put through duplicate removal — anything already
 * published, or repeated inside the same batch, is marked as a duplicate and
 * leaves the queue — and whatever survives is approved and published straight
 * to the site. Readers still remove a story with a dislike, and editors can
 * permanently purge from the Command Center.
 */
export async function autoApproveNewsQueue(limit = 300): Promise<{
  duplicates: number;
  approved: number;
  published: number;
}> {
  const db = await admin();

  const { data, error } = await db
    .from("raw_ingestion_items")
    .select("id,dedupe_key,canonical_url,original_title,dedupe_status,priority_score")
    .in("processing_status", PENDING_STATES as unknown as string[])
    .order("priority_score", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 500));
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as PendingRow[];
  if (!rows.length) return { duplicates: 0, approved: 0, published: 0 };

  // Already-live keys and links: a repeat of published content is a duplicate.
  const keys = rows.map((r) => r.dedupe_key).filter((k): k is string => Boolean(k));
  const urls = rows.map((r) => r.canonical_url).filter((u): u is string => Boolean(u));
  const live = new Set<string>();
  if (keys.length) {
    const { data: byKey } = await db
      .from("content_items")
      .select("dedupe_key")
      .in("dedupe_key", keys.slice(0, 300));
    for (const r of (byKey ?? []) as Array<{ dedupe_key: string | null }>) {
      if (r.dedupe_key) live.add(`k:${r.dedupe_key}`);
    }
  }
  if (urls.length) {
    const { data: byUrl } = await db
      .from("content_items")
      .select("link_url")
      .in("link_url", urls.slice(0, 300));
    for (const r of (byUrl ?? []) as Array<{ link_url: string | null }>) {
      if (r.link_url) live.add(`u:${r.link_url}`);
    }
  }

  const duplicateIds: string[] = [];
  const keepIds: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const key = row.dedupe_key ?? row.canonical_url ?? row.id;
    const isDuplicate =
      row.dedupe_status === "duplicate" ||
      seen.has(key) ||
      (row.dedupe_key ? live.has(`k:${row.dedupe_key}`) : false) ||
      (row.canonical_url ? live.has(`u:${row.canonical_url}`) : false);
    if (isDuplicate) {
      duplicateIds.push(row.id);
      continue;
    }
    seen.add(key);
    keepIds.push(row.id);
  }

  for (let i = 0; i < duplicateIds.length; i += 200) {
    const ids = duplicateIds.slice(i, i + 200);
    await db
      .from("raw_ingestion_items")
      .update({ processing_status: "duplicate", dedupe_status: "duplicate" })
      .in("id", ids);
  }

  let published = 0;
  if (keepIds.length) {
    const { publishRawItems } = await import("@/lib/ingest-publish.server");
    for (let i = 0; i < keepIds.length; i += 50) {
      const ids = keepIds.slice(i, i + 50);
      await db.from("raw_ingestion_items").update({ processing_status: "approved" }).in("id", ids);
      await db
        .from("editorial_reviews")
        .insert(ids.map((id) => ({ raw_item_id: id, action: "auto-publish" })));
      published += await publishRawItems(ids);
    }
  }

  return { duplicates: duplicateIds.length, approved: keepIds.length, published };
}
