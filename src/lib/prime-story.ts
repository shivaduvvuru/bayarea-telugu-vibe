/**
 * Prime-story rotation.
 *
 * The prime banner at the top of the homepage is a hand-built feature (the Bay
 * Area housing explainer). Left alone it would sit there forever and go stale,
 * so it carries a publish date and an age threshold: once the feature is older
 * than PRIME_MAX_AGE_DAYS the homepage retires it and promotes the freshest
 * local story into the prime slot instead.
 */

/** When the current hand-built prime feature was published (ISO date). */
export const PRIME_BANNER_PUBLISHED_AT = "2026-08-13T00:00:00.000Z";

/** How long a prime story may hold the slot before it is rotated out (half a day). */
export const PRIME_MAX_AGE_DAYS = 0.5;

const DAY_MS = 24 * 60 * 60 * 1000;

export function ageInDays(iso: string, now: Date = new Date()): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return Number.POSITIVE_INFINITY;
  return (now.getTime() - then) / DAY_MS;
}

/** True while the hand-built banner is still inside its freshness window. */
export function isPrimeBannerFresh(
  now: Date = new Date(),
  publishedAt: string = PRIME_BANNER_PUBLISHED_AT,
  maxAgeDays: number = PRIME_MAX_AGE_DAYS,
): boolean {
  return ageInDays(publishedAt, now) <= maxAgeDays;
}

/**
 * Popular-story scoring for the prime slot.
 *
 * Once the hand-built banner ages out, the top of the homepage leads with the
 * story most likely to matter to readers right now: something new, from a
 * high-traffic US city or of national interest, with artwork attached. The
 * score is recomputed on every render, so as soon as collection brings in a
 * stronger story it takes over the slot.
 */

/** Big US metros plus the Bay Area cities our readers live in. */
const POPULAR_PLACES = [
  "bay area", "san francisco", "san jose", "fremont", "santa clara", "sunnyvale",
  "cupertino", "palo alto", "oakland", "milpitas", "pleasanton", "dublin",
  "san ramon", "mountain view", "silicon valley", "california",
  "new york", "chicago", "dallas", "houston", "austin", "atlanta", "seattle",
  "boston", "washington", "new jersey", "phoenix", "los angeles", "texas",
];

/** Subjects that reliably draw the most readers. */
const POPULAR_TOPICS = [
  "h-1b", "h1b", "green card", "visa", "immigration", "uscis", "trump",
  "telugu", "indian american", "nri", "layoff", "hiring", "tech", "google",
  "apple", "nvidia", "tesla", "housing", "rent", "school", "election",
  "police", "crash", "fire", "storm", "earthquake", "students", "startup",
];

export type PrimeCandidate = {
  title: string;
  excerpt?: string;
  date: string;
  image?: string | null;
  category?: string;
};

/** 0-100 popularity score; higher wins the prime slot. */
export function primeScore(a: PrimeCandidate, now: Date = new Date()): number {
  const text = `${a.title} ${a.excerpt ?? ""}`.toLowerCase();
  const hours = Math.max(0, (now.getTime() - new Date(a.date).getTime()) / 3_600_000);
  let score = Math.max(0, 40 - hours); // freshness: strongest in the first two days
  if (POPULAR_PLACES.some((p) => text.includes(p))) score += 22;
  if (POPULAR_TOPICS.some((t) => text.includes(t))) score += 18;
  if (a.image) score += 12;
  if (a.title.length > 40) score += 4; // real headlines over stubs
  if (a.category === "gallery") score -= 30; // photo tiles are not a lead story
  return score;
}

/** Picks the strongest candidate, falling back to the first item. */
export function pickPrimeStory<T extends PrimeCandidate>(
  candidates: T[],
  now: Date = new Date(),
): T | undefined {
  let best: T | undefined;
  let bestScore = -Infinity;
  for (const c of candidates) {
    const s = primeScore(c, now);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return best ?? candidates[0];
}
