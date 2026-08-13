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

/**
 * Gallery is a star picture desk, not a headline feed: it only carries
 * photo-led coverage of Telugu / Hindi / OTT heroines and stars.
 */
const STAR_PERSON =
  /\b(?:actress|heroine|star(?:let)?|glam(?:our|orous)?|beauty|diva|model|hero(?:ine)?s)\b/i;

const PHOTO_LED =
  /\b(?:photos?|pics?|pictures?|stills?|gallery|galleries|photoshoot|photo shoot|shoot|snaps?|clicks?|looks?|new look|latest look|saree|traditional look|red carpet|ramp walk|magazine cover|cover shoot|poses|stunning|gorgeous|viral (?:photos|pics))\b/i;

/** True for heroine / star photo features that belong in the Gallery grid. */
export function isStarGallery(
  title: string | null | undefined,
  summary?: string | null,
  sourceUrl?: string | null,
): boolean {
  const text = `${title ?? ""} ${summary ?? ""}`;
  if (!isCinema(title, summary, sourceUrl) && !STAR_PERSON.test(text)) return false;
  return STAR_PERSON.test(text) && PHOTO_LED.test(text);
}

