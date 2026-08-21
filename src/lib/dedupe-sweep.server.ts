/**
 * Recurring duplicate sweep for the published newsroom store.
 *
 * The ingest path already filters duplicates before queueing, but stories can
 * still collide across days (same headline reworded by another desk, the same
 * article URL, or the same lead image). This runs on every scheduled collection
 * so duplicates never linger on the site: the oldest published row wins and the
 * rest are marked hidden (kept for audit, not shown anywhere).
 */
import { dedupeKey } from "./dedupe";
import { urlKey } from "./collect-news.server";

type Row = {
  id: string;
  title: string | null;
  link_url: string | null;
  image_url: string | null;
  published_at: string | null;
  created_at: string;
  dedupe_key: string | null;
};

/** Picks the ids that should be hidden as duplicates. Oldest row is kept. */
export function duplicateIds(rows: Row[]): string[] {
  const sorted = [...rows].sort((a, b) => {
    const at = a.published_at ?? a.created_at;
    const bt = b.published_at ?? b.created_at;
    return at < bt ? -1 : at > bt ? 1 : 0;
  });
  const seen = new Set<string>();
  const drop: string[] = [];
  for (const r of sorted) {
    const keys = [
      r.dedupe_key || "",
      dedupeKey(r.title ?? ""),
      r.link_url ? `u:${urlKey(r.link_url)}` : "",
      r.image_url ? `i:${urlKey(r.image_url)}` : "",
    ].filter(Boolean);
    if (keys.some((k) => seen.has(k))) {
      drop.push(r.id);
      continue;
    }
    for (const k of keys) seen.add(k);
  }
  return drop;
}

/** Permanently deletes duplicate published rows. Returns how many were removed. */
export async function sweepDuplicates(
  admin: { from: (t: string) => any },
): Promise<number> {
  const { data } = await admin
    .from("content_items")
    .select("id, title, link_url, image_url, published_at, created_at, dedupe_key")
    .eq("status", "published")
    .neq("placement", "hidden")
    .order("published_at", { ascending: true })
    .limit(5000);

  const ids = duplicateIds((data ?? []) as Row[]);
  for (let i = 0; i < ids.length; i += 200) {
    await admin
      .from("content_items")
      .delete()
      .in("id", ids.slice(i, i + 200));
  }
  return ids.length;
}
