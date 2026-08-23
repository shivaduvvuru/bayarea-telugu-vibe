/**
 * Publish-time classification.
 *
 * Reads used to pull hundreds of rows and re-run every regex classifier on
 * each one. The same decisions are now taken once, when a row is published,
 * and stored on `content_items.resolved_category` / `is_local` so reader
 * queries become small indexed lookups.
 *
 * The logic here is the existing read-time logic, moved — it imports the same
 * helpers (bay-area, india-topics, cinema-topics, microdrama-topics, content)
 * so a story lands in exactly the section it landed in before.
 */
import { CITY_CATEGORIES } from "./content";
import { isBayArea, isBayAreaSource } from "./bay-area";
import { classifyIndia, INDIA_SLUGS } from "./india-topics";
import { isCinema, isStarGallery, CINEMA_SLUG } from "./cinema-topics";
import { isMicroDrama, MICRO_DRAMA_SLUG } from "./microdrama-topics";

export type ClassifiableRow = {
  title: string | null;
  summary?: string | null;
  link_url: string | null;
  city?: string | null;
  category?: string | null;
};

/** First-party newsroom posts carry their section in the permalink path. */
export function ownSiteSection(link: string | null | undefined): string | null {
  if (!link || !link.includes("bayarea.telugutimes.net")) return null;
  try {
    const seg = new URL(link).pathname.split("/").filter(Boolean)[0]?.toLowerCase();
    return seg ?? null;
  } catch {
    return null;
  }
}

/** City rows store the display name ("San Jose"); pages address them by slug. */
export function citySlugOf(city: string | null | undefined): string | undefined {
  if (!city) return undefined;
  const needle = city.trim().toLowerCase();
  return CITY_CATEGORIES.find((c) => c.en.toLowerCase() === needle || c.slug === needle)?.slug;
}

/**
 * The stored category a row reads as, before city/topic resolution. Mirrors the
 * head of `toArticle` in cms-articles.server.ts.
 */
export function storedCategory(row: ClassifiableRow): string | null {
  const own = ownSiteSection(row.link_url);
  if (own !== null) {
    if (own === "cinema") return CINEMA_SLUG;
    if (row.category === "news" || !row.category) {
      if (own === "temples") return "temples";
      if (own === "events") return "events";
      return row.category ?? null;
    }
    return row.category;
  }
  if (row.category === "news" || !row.category) {
    if (
      isMicroDrama(row.title, row.summary, row.link_url) ||
      isCinema(row.title, row.summary, row.link_url)
    ) {
      return CINEMA_SLUG;
    }
    return classifyIndia(row.title, row.summary, row.link_url) ?? row.category ?? null;
  }
  return row.category;
}

/**
 * The section a published row belongs to.
 *
 * Picture-desk rows (editor-approved gallery picks and star photo features)
 * resolve to "gallery"; that is exactly the set the gallery feed used to pick
 * out with `isStarGallery`, and the set city news used to exclude.
 */
export function resolveCategory(row: ClassifiableRow): string {
  if (row.category === "gallery") return "gallery";
  if (isStarGallery(row.title, row.summary, row.link_url)) return "gallery";
  const stored = storedCategory(row);
  if (stored === CINEMA_SLUG || stored === MICRO_DRAMA_SLUG) return CINEMA_SLUG;
  return citySlugOf(row.city) ?? stored ?? "community";
}

/**
 * True when a row belongs in the Bay Area (city news) digest: a positive local
 * signal from the headline or the publisher, with India, cinema, micro-drama
 * and picture-desk coverage excluded — the same test the city-news read used.
 */
export function resolveIsLocal(
  title: string | null | undefined,
  linkUrl: string | null | undefined,
  summary?: string | null,
  category?: string | null,
): boolean {
  if (category === CINEMA_SLUG || category === MICRO_DRAMA_SLUG || category === "gallery") {
    return false;
  }
  if (isMicroDrama(title, summary, linkUrl)) return false;
  const own = ownSiteSection(linkUrl);
  if (own !== null) {
    if (own === "cinema" || own === "gallery") return false;
    return isBayArea(title) || isBayAreaSource(linkUrl);
  }
  if (INDIA_SLUGS.includes(category as (typeof INDIA_SLUGS)[number])) return false;
  if (classifyIndia(title, summary, linkUrl) !== null) return false;
  if (isCinema(title, summary, linkUrl)) return false;
  if (isStarGallery(title, summary, linkUrl)) return false;
  return isBayArea(title) || isBayAreaSource(linkUrl);
}

/** Both publish-time fields for an insert/update payload. */
export function classifyForPublish(row: ClassifiableRow) {
  return {
    resolved_category: resolveCategory(row),
    is_local: resolveIsLocal(row.title, row.link_url, row.summary, row.category),
  };
}
