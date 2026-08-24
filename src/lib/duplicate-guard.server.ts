/**
 * Automatic, server-side duplicate prevention for article writes.
 *
 * Every entry point that can create a story — public submission, admin post,
 * automated feed ingest and the publish backlog — runs `findArticleDuplicate`
 * before saving. There is no review step and no override: a match is discarded
 * silently, logged to `rejected_duplicates` with the id of the original, and the
 * caller is handed the existing article's id instead.
 *
 * Matching rules (first hit wins, evaluated in the database):
 *  1. identical or normalised title (lowercase, punctuation stripped)
 *  2. identical link / source URL
 *  3. body text similarity >= threshold (pg_trgm), last 30 days
 *
 * Threshold note: 0.85 can occasionally catch a genuine follow-up to a breaking
 * story, so headlines that read as updates are exempted from the *body* rule
 * (they still must not repeat a title or URL).
 */

export const BODY_SIMILARITY_THRESHOLD = 0.85;

const UPDATE_HEADLINE =
  /\b(update[ds]?|latest|live|breaking|developing|follow[- ]?up|part\s?\d|day\s?\d)\b/i;

export type DuplicateHit = {
  id: string;
  score: number;
  reason: "title" | "url" | "body";
};

type Db = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  from: (table: string) => any;
};

export function normalizeTitle(title: string | null | undefined): string {
  return (title ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0C00-\u0C7F]+/g, " ")
    .trim();
}

/** Strips markup so trigram similarity compares prose, not tags. */
function plainText(body: string | null | undefined): string | null {
  if (!body) return null;
  const text = body
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length >= 200 ? text.slice(0, 6000) : null;
}

/**
 * Returns the existing article this candidate repeats, or null when it is new.
 * Never throws: if the check itself fails the write proceeds (the recurring
 * sweep will catch anything that slips through).
 */
export async function findArticleDuplicate(
  db: Db,
  candidate: {
    title?: string | null;
    link_url?: string | null;
    body?: string | null;
    threshold?: number;
  },
): Promise<DuplicateHit | null> {
  const title = candidate.title ?? "";
  if (!normalizeTitle(title) && !candidate.link_url) return null;
  // Follow-ups keep their own body comparison out of scope (see header note).
  const body = UPDATE_HEADLINE.test(title) ? null : plainText(candidate.body);
  try {
    const { data, error } = await db.rpc("find_article_duplicate", {
      _title: title,
      _link: candidate.link_url ?? null,
      _body: body,
      _threshold: candidate.threshold ?? BODY_SIMILARITY_THRESHOLD,
    });
    if (error) return null;
    const rows = (data ?? []) as DuplicateHit[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/** Records a discarded repeat. Logging only — nothing here waits for a human. */
export async function logRejectedDuplicate(
  db: Db,
  entry: {
    kind?: "article" | "image";
    reason: string;
    score?: number | null;
    title?: string | null;
    link_url?: string | null;
    dedupe_key?: string | null;
    original_id?: string | null;
    original_url?: string | null;
    source?: string | null;
    entry_point: string;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await db.from("rejected_duplicates").insert({
      kind: entry.kind ?? "article",
      reason: entry.reason,
      score: entry.score ?? null,
      title: entry.title ?? null,
      link_url: entry.link_url ?? null,
      dedupe_key: entry.dedupe_key ?? null,
      original_id: entry.original_id ?? null,
      original_url: entry.original_url ?? null,
      source: entry.source ?? null,
      entry_point: entry.entry_point,
      payload: entry.payload ?? {},
    });
  } catch (err) {
    console.error("logRejectedDuplicate failed", err);
  }
}

/**
 * One call for the common case: check, log when it is a repeat, and tell the
 * caller which existing article the content belongs to.
 */
export async function guardArticle(
  db: Db,
  candidate: {
    title?: string | null;
    link_url?: string | null;
    body?: string | null;
    dedupe_key?: string | null;
    source?: string | null;
    entry_point: string;
    threshold?: number;
  },
): Promise<{ duplicate: false } | { duplicate: true; hit: DuplicateHit }> {
  const hit = await findArticleDuplicate(db, candidate);
  if (!hit) return { duplicate: false };
  await logRejectedDuplicate(db, {
    reason: hit.reason,
    score: hit.score,
    title: candidate.title ?? null,
    link_url: candidate.link_url ?? null,
    dedupe_key: candidate.dedupe_key ?? null,
    original_id: hit.id,
    source: candidate.source ?? null,
    entry_point: candidate.entry_point,
  });
  return { duplicate: true, hit };
}
