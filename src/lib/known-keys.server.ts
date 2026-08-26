/**
 * One loader for "stories the site already knows about".
 *
 * Before this, every run read digest_queue / content_items / digest_rejects
 * twice (once in the collector for the summary skip, once in the route for
 * the duplicate filter), unpaged in one place (silently capped at 1000 rows)
 * and paged up to 12 000 rows in the other — on a hook that fires every minute.
 *
 * Now: one call, paged, restricted to a recent window (stories older than the
 * feed horizon can't repeat through a feed anyway), and memoised per process
 * for a short TTL so back-to-back runs pay for it once.
 */
import { storyIdentityKeys } from "./collect-news.server";
import { strictTitleKey } from "./dedupe";

export type KnownKeys = {
  /** `d:<dedupe_key|item_id>` and `u:/t:/ut:` identity keys, all in one set. */
  keys: Set<string>;
  /** Published rows that still lack artwork — used for the cheap image repair. */
  imageless: { id: string; link_url: string }[];
  loadedAt: number;
};

const PAGE = 1000;
const MAX_PAGES = 8;
const TTL_MS = 4 * 60_000;
/** Feeds never carry anything older than this, so older rows cannot duplicate. */
const WINDOW_DAYS = 21;

let cache: KnownKeys | null = null;

type Admin = { from: (t: string) => any };

async function readWindow<T>(
  db: Admin,
  table: string,
  columns: string,
  dateColumn: string,
  since: string,
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE;
    const { data, error } = await db
      .from(table)
      .select(columns)
      .gte(dateColumn, since)
      .order(dateColumn, { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const chunk = (data ?? []) as T[];
    out.push(...chunk);
    if (chunk.length < PAGE) break;
  }
  return out;
}

export async function loadKnownKeys(db: Admin, opts: { force?: boolean } = {}): Promise<KnownKeys> {
  if (!opts.force && cache && Date.now() - cache.loadedAt < TTL_MS) return cache;
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const sinceDay = since.slice(0, 10);
  const keys = new Set<string>();
  const imageless: { id: string; link_url: string }[] = [];

  const [queued, live, rejected] = await Promise.all([
    readWindow<{ dedupe_key: string | null; item_id: string | null; title: string | null; source_url: string | null }>(
      db, "digest_queue", "dedupe_key, item_id, title, source_url", "digest_date", sinceDay,
    ),
    readWindow<{
      id: string; title: string | null; link_url: string | null; source_ref: string | null;
      dedupe_key: string | null; image_url: string | null;
    }>(db, "content_items", "id, title, link_url, source_ref, dedupe_key, image_url", "created_at", since),
    readWindow<{ dedupe_key: string | null; item_id: string | null; title: string | null }>(
      db, "digest_rejects", "dedupe_key, item_id, title", "created_at", since,
    ).catch(() => [] as { dedupe_key: string | null; item_id: string | null; title: string | null }[]),
  ]);

  const addTitle = (title: string | null) => {
    const t = strictTitleKey(title);
    if (t) keys.add(`t:${t}`);
  };
  for (const r of queued) {
    addTitle(r.title);
    if (r.dedupe_key) keys.add(`d:${r.dedupe_key}`);
    if (r.item_id) keys.add(`d:${r.item_id}`);
    for (const k of storyIdentityKeys(r.title, r.source_url)) keys.add(k);
  }
  for (const r of live) {
    addTitle(r.title);
    if (r.dedupe_key) keys.add(`d:${r.dedupe_key}`);
    const ref = (r.source_ref ?? "").replace(/^editorial-desk:/, "");
    if (ref) keys.add(`d:${ref}`);
    for (const k of storyIdentityKeys(r.title, r.link_url ?? r.source_ref)) keys.add(k);
    if (!r.image_url && r.link_url) imageless.push({ id: r.id, link_url: r.link_url });
  }
  for (const r of rejected) {
    addTitle(r.title);
    if (r.dedupe_key) keys.add(`d:${r.dedupe_key}`);
    if (r.item_id) keys.add(`d:${r.item_id}`);
    for (const k of storyIdentityKeys(r.title, null)) keys.add(k);
  }

  cache = { keys, imageless, loadedAt: Date.now() };
  return cache;
}

/** Call after a successful upsert so the next run in this process sees the new rows. */
export function rememberKeys(newKeys: Iterable<string>) {
  if (!cache) return;
  for (const k of newKeys) cache.keys.add(k);
}

export function isKnownStory(known: KnownKeys, row: { dedupe_key: string; item_id?: string; title: string; source_url: string | null }) {
  if (known.keys.has(`d:${row.dedupe_key}`)) return true;
  if (row.item_id && known.keys.has(`d:${row.item_id}`)) return true;
  return storyIdentityKeys(row.title, row.source_url).some((k) => known.keys.has(k));
}
