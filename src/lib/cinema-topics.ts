/**
 * Client-safe classifier for Telugu / Indian cinema coverage.
 *
 * Movie stories collected from Tollywood and Bollywood desks used to land in the
 * generic "news" bucket. This files them under the site's Cinema section, and
 * photo-led film stories also surface in Gallery.
 */

export const CINEMA_SLUG = "cinema";

const CINEMA_TEXT =
  /tollywood|bollywood|kollywood|telugu (?:film|movie|cinema|actor|actress|hero|heroine)|hindi (?:film|movie|cinema)|box office|first look|teaser|trailer|movie review|film review|ott release|pre[- ]release (?:event|business)|audio launch|censor|cast(?:ing)? (?:announce|update)|shooting (?:begins|update|wrap)|film ?fare|national film award|\bbiopic\b/i;

/** Well-known film-trade publishers whose whole feed is cinema. */
const CINEMA_HOSTS =
  /123telugu|gulte|greatandhra|idlebrain|m9\.news|filmibeat|pinkvilla|bollywoodhungama|cinejosh|telugu360\.com\/(?:entertainment|movies)|sacnilk|koimoi|indiaglitz/i;

/** True when a story reads as film / entertainment coverage. */
export function isCinema(
  title: string | null | undefined,
  summary?: string | null,
  sourceUrl?: string | null,
): boolean {
  const text = `${title ?? ""} ${summary ?? ""}`;
  if (CINEMA_TEXT.test(text)) return true;
  return CINEMA_HOSTS.test((sourceUrl ?? "").toLowerCase());
}
