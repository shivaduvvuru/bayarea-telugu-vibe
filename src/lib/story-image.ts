/**
 * Some publishers (notably Patch) expose only their own logo as the article
 * image, so every story ends up with the same picture. Reject those and let the
 * card fall back to its typographic tile instead.
 */
const BLOCKED =
  /(?:^|\.)patch\.com$|patch\.com|patchcdn|patch-?(?:am|logo)|logo|sprite|favicon|placeholder|default[-_]?(?:image|thumb)|avatar|blank\.|1x1|spacer|watermark/i;


/** Tiny thumbnails and crops: skip them so tiles get a real photo. */
const TOO_SMALL = /-\d{2,3}x\d{2,3}\.|\b(?:thumb(?:nail)?s?|small|icon|mini|75x75|150x150)\b|[?&](?:w|width)=(?:\d{1,2}|[12]\d\d)\b/i;

export function looksHighRes(url: string | null | undefined): boolean {
  if (!url) return false;
  return !TOO_SMALL.test(url);
}

export function usableImage(url: string | null | undefined): string | null {
  if (!url) return null;
  const raw = url.trim();
  if (!raw || BLOCKED.test(raw) || TOO_SMALL.test(raw)) return null;
  return raw;
}

/** Publisher names we prefer to spell out when crediting artwork. */
const NAMES: Record<string, string> = {
  "timesofindia.indiatimes.com": "The Times of India",
  "indiatimes.com": "The Times of India",
  "ndtv.com": "NDTV",
  "thehindu.com": "The Hindu",
  "hindustantimes.com": "Hindustan Times",
  "indianexpress.com": "The Indian Express",
  "mercurynews.com": "The Mercury News",
  "sfchronicle.com": "San Francisco Chronicle",
  "sfgate.com": "SFGATE",
  "abc7news.com": "ABC7 News",
  "nbcbayarea.com": "NBC Bay Area",
  "ktvu.com": "KTVU",
  "kron4.com": "KRON4",
  "eenadu.net": "Eenadu",
  "sakshi.com": "Sakshi",
  "deccanchronicle.com": "Deccan Chronicle",
  "msn.com": "MSN",
};

/**
 * Human-readable credit for a story's source, derived from its publisher URL.
 * Used to attribute both the headline link and any artwork we hotlink.
 */
export function sourceLabel(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (NAMES[host]) return NAMES[host] as string;
    const base = host.split(".").slice(0, -1).join(".") || host;
    const known = Object.keys(NAMES).find((k) => host.endsWith(k));
    if (known) return NAMES[known] as string;
    return base
      .split(".")
      .slice(-1)[0]!
      .split("-")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
  } catch {
    return null;
  }
}

/**
 * Quality gate for the Glamourie grid. Picture desks sometimes attach stock
 * artwork that has nothing to do with a star portrait — nature shots, birds,
 * temple/church crosses, maps, weather graphics, sports frames. Those slipped
 * into the photo grid, so reject them by URL/slug cue and keep only pictures
 * that read as people photography.
 */
const NOT_A_PORTRAIT =
  /\b(?:bird|birds|eagle|parrot|peacock|animal|wildlife|dog|cat|tiger|lion|elephant|nature|landscape|sunset|sunrise|mountain|forest|tree|flower|garden|beachscape|cross|crucifix|church|chapel|cathedral|temple|mosque|masjid|shrine|idol|god|deity|festival-?graphic|map|maps|chart|graph|graphic|infographic|weather|rain|storm|flood|traffic|accident|crash|police|court|stadium|cricket|match|scorecard|trophy|stocks?|market|currency|coin|crypto|car|bike|vehicle|building|construction|flag|poster-?only|screenshot|whatsapp-?image|collage-?graphic)\b/i;

/** Usable image that also passes the Glamourie subject check. */
export function galleryImage(url: string | null | undefined): string | null {
  const ok = usableImage(url);
  if (!ok) return null;
  let path = ok;
  try {
    const u = new URL(ok);
    path = `${u.pathname}`;
  } catch {
    /* keep raw string */
  }
  if (NOT_A_PORTRAIT.test(decodeURIComponent(path).replace(/[_%20+]/g, "-"))) return null;
  return ok;
}
