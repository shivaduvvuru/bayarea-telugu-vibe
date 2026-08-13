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
