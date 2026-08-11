/**
 * Shared duplicate detection for automatically pulled and submitted content.
 * Imports can carry several near-identical listings (SAFEWAY x5, Trader Joe's
 * x3), and news feeds re-publish the same headline, so every ingest path
 * normalises the title the same way and reports what it collapsed.
 */

const NOISE =
  /\b(the|a|an|of|and|in|at|for|to|on|with|inc|llc|ltd|store|market|markets)\b/g;

/** Lowercase, strip punctuation, accents, noise words and trailing slug numbers. */
export function dedupeKey(title: string) {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&(amp|#0?38);/g, "and")
    .replace(NOISE, " ")
    .replace(/[^a-z0-9\u0C00-\u0C7F]+/g, "")
    .replace(/\d+$/, "");
}

export type Duplicate<T> = { kept: T; dropped: T[]; key: string };

/**
 * Collapses items sharing a dedupe key. The first occurrence wins; the rest are
 * returned so the newsroom can be alerted instead of silently losing them.
 */
export function dedupeBy<T>(
  items: T[],
  titleOf: (item: T) => string,
): { unique: T[]; duplicates: Duplicate<T>[] } {
  const byKey = new Map<string, { kept: T; dropped: T[] }>();
  const unique: T[] = [];
  for (const item of items) {
    const key = dedupeKey(titleOf(item));
    if (!key) {
      unique.push(item);
      continue;
    }
    const seen = byKey.get(key);
    if (seen) {
      seen.dropped.push(item);
      continue;
    }
    byKey.set(key, { kept: item, dropped: [] });
    unique.push(item);
  }
  const duplicates: Duplicate<T>[] = [];
  for (const [key, group] of byKey) {
    if (group.dropped.length > 0) duplicates.push({ key, ...group });
  }
  return { unique, duplicates };
}