/**
 * Shared per-isolate content cache for WordPress reads.
 * Lives in its own module so the scheduled refresh endpoint can warm/clear it.
 */
import { CITY_CATEGORIES } from "@/lib/wp";

export type CacheEntry = { at: number; value: unknown };

export const wpCache = new Map<string, CacheEntry>();

/** Twice-daily scheduled pulls keep this fresh; TTL is the safety net. */
export const TTL_MS = 6 * 60 * 60 * 1000;

export function clearWpCache() {
  const size = wpCache.size;
  wpCache.clear();
  return size;
}

/** Bay Area city, temple, community and event feeds pulled on a schedule. */
export const REFRESH_CATEGORIES = [
  "city-news",
  ...CITY_CATEGORIES.map((c) => c.slug),
  "temples",
  "community",
  "associations",
  "events-community",
  "groups",
  "people",
  "restaurants",
  "classifieds",
];