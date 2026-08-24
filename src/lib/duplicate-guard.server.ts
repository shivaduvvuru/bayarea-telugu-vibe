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
 *  3. headline similarity >= 0.85 (pg_trgm), last 7 days
 *  4. loose headline similarity >= 0.55, OR >= 3 shared proper nouns/numbers,
 *     inside 72 hours — the "same story, different publisher" case
 *  5. body text similarity >= threshold (pg_trgm), last 30 days
 *
 * Rule 4 is in OBSERVATION MODE until `OBSERVE_LOOSE_UNTIL`: matches are logged
 * to `rejected_duplicates` (reason `title-weak` / `tokens`) but the story is
 * still published, so the thresholds can be tuned on real pairs before anything
 * is hidden automatically. Remove the date to make it blocking.
 *
 * Threshold note: 0.85 can occasionally catch a genuine follow-up to a breaking
 * story, so headlines that read as updates are exempted from the *body* rule
 * (they still must not repeat a title or URL).
 */

export const BODY_SIMILARITY_THRESHOLD = 0.85;
/** Loose headline threshold for cross-publisher repeats. */
export const LOOSE_TITLE_THRESHOLD = 0.55;
/** Until this date, loose matches are recorded but not acted on. */
export const OBSERVE_LOOSE_UNTIL = Date.parse("2026-09-01T00:00:00Z");

const UPDATE_HEADLINE =
  /\b(update[ds]?|latest|live|breaking|developing|follow[- ]?up|part\s?\d|day\s?\d)\b/i;

export type DuplicateReason =
  | "title"
  | "url"
  | "body"
  | "title-weak"
  | "tokens"
  | "url-canonical"
  | "title-source"
  | "image-canonical";

export type DuplicateHit = {
  id: string;
  score: number;
  reason: DuplicateReason;
};

/** True while a loose match should only be logged, never enforced. */
export function isObservationOnly(reason: DuplicateReason): boolean {
  return (
    (reason === "title-weak" || reason === "tokens") && Date.now() < OBSERVE_LOOSE_UNTIL
  );
}

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
 * Three exact-match hard rejects, run before any similarity scoring. No
 * threshold, no observation window: a hit here is always a duplicate.
 *
 *  1. canonical URL — the same story served under a different section path,
 *     /amp copy, tracking parameter or trailing slash (Times of India reduced
 *     to its `articleshow/<id>.cms` id).
 *  2. strict headline + same publisher within 14 days.
 *  3. canonical image — same photo, size/crop parameters stripped.
 */
export async function findHardDuplicate(
  db: Db,
  candidate: {
    title?: string | null;
    link_url?: string | null;
    source?: string | null;
    image_url?: string | null;
  },
): Promise<DuplicateHit | null> {
  const url = canonicalUrl(candidate.link_url);
  const title = strictTitleKey(candidate.title);
  const image = canonicalImage(candidate.image_url);
  const rows = async (column: string, value: string, extra?: (q: any) => any) => {
    let q = db
      .from("content_items")
      .select("id, source, canonical_url, created_at")
      .neq("status", "duplicate")
      .eq(column, value)
      .order("created_at", { ascending: true })
      .limit(5);
    if (extra) q = extra(q);
    const { data } = await q;
    return (data ?? []) as { id: string; source: string | null; canonical_url: string | null }[];
  };

  if (url) {
    const hit = (await rows("canonical_url", url))[0];
    if (hit) return { id: hit.id, score: 1, reason: "url-canonical" };
  }
  if (title) {
    const since = new Date(Date.now() - 14 * 864e5).toISOString();
    const found = await rows("norm_title", title, (q) => q.gte("created_at", since));
    const host = url?.split("/")[0] ?? null;
    // Same headline from the same publisher is a repeat, full stop.
    const same = found.find(
      (r) =>
        (candidate.source && r.source === candidate.source) ||
        (host && (r.canonical_url ?? "").split("/")[0] === host),
    );
    if (same) return { id: same.id, score: 1, reason: "title-source" };
  }
  if (image) {
    const hit = (await rows("canonical_image", image))[0];
    if (hit) return { id: hit.id, score: 1, reason: "image-canonical" };
  }
  return null;
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
    source?: string | null;
    image_url?: string | null;
    threshold?: number;
  },
): Promise<DuplicateHit | null> {
  const title = candidate.title ?? "";
  if (!normalizeTitle(title) && !candidate.link_url) return null;
  try {
    const hard = await findHardDuplicate(db, candidate);
    if (hard) return hard;
  } catch (err) {
    console.error("hard duplicate check failed", err);
  }
  // Follow-ups keep their own body comparison out of scope (see header note).
  const body = UPDATE_HEADLINE.test(title) ? null : plainText(candidate.body);
  try {
    const { data, error } = await db.rpc("find_article_duplicate", {
      _title: title,
      _link: candidate.link_url ?? null,
      _body: body,
      _threshold: candidate.threshold ?? BODY_SIMILARITY_THRESHOLD,
      _loose: LOOSE_TITLE_THRESHOLD,
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
  const observed = isObservationOnly(hit.reason);
  await logRejectedDuplicate(db, {
    reason: observed ? `observe:${hit.reason}` : hit.reason,
    score: hit.score,
    title: candidate.title ?? null,
    link_url: candidate.link_url ?? null,
    dedupe_key: candidate.dedupe_key ?? null,
    original_id: hit.id,
    source: candidate.source ?? null,
    entry_point: candidate.entry_point,
    payload: observed ? { mode: "observation", enforced: false } : {},
  });
  // Observation window: the pair is recorded for tuning, the story still runs.
  if (observed) return { duplicate: false };
  return { duplicate: true, hit };
}
