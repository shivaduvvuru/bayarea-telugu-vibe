/**
 * Shared duplicate detection for automatically pulled and submitted content.
 * Imports can carry several near-identical listings (SAFEWAY x5, Trader Joe's
 * x3), and news feeds re-publish the same headline, so every ingest path
 * normalises the title the same way and reports what it collapsed.
 */
import { usableImage } from "./story-image";


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
/** Content keys used to spot the same story arriving with a re-worded headline. */
export function contentDedupeKeys(item: {
  title?: string | null;
  sourceUrl?: string | null;
  url?: string | null;
  link_url?: string | null;
  image?: string | null;
  image_url?: string | null;
}): string[] {
  const title = dedupeKey(item.title ?? "");
  // Feeds and CMS rows name these fields differently; accept every spelling so
  // one story cannot slip through under an alternate key.
  const url = item.sourceUrl ?? item.link_url ?? item.url;
  const image = usableImage(item.image ?? item.image_url);
  return [
    title ? `t:${title}` : "",
    // Near-duplicate headlines (same story, different tail) collapse too.
    title.length > 28 ? `p:${title.slice(0, 28)}` : "",
    url ? `u:${url.split("?")[0]?.replace(/\/$/, "").toLowerCase()}` : "",
    image ? `i:${image.split("?")[0]?.toLowerCase()}` : "",
  ].filter(Boolean);
}


/** Keeps the first copy of each story across any number of feeds. */
export function uniqueByContent<
  T extends { title?: string | null; sourceUrl?: string | null; image?: string | null },
>(items: T[], seen = new Set<string>()): T[] {
  const out: T[] = [];
  for (const item of items) {
    const keys = contentDedupeKeys(item);
    if (keys.some((k) => seen.has(k))) continue;
    keys.forEach((k) => seen.add(k));
    out.push(item);
  }
  return out;
}
