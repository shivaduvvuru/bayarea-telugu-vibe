/**
 * Some publishers (notably Patch) expose only their own logo as the article
 * image, so every story ends up with the same picture. Reject those and let the
 * card fall back to its typographic tile instead.
 */
const BLOCKED =
  /(?:^|\.)patch\.com$|patch\.com|patchcdn|patch-?(?:am|logo)|logo|sprite|favicon|placeholder|default[-_]?(?:image|thumb)|avatar|blank\.|1x1|spacer|watermark|header[-_]?ad|\/ads\/|\/advert|\/adserver|doubleclick|consent\.yahoo\.com|yahoo_frontpage/i;


/** Tiny thumbnails and crops: skip them so tiles get a real photo. */
// Only genuinely unusable sizes are rejected now: an icon, sprite or a crop
// under ~120px. Everything larger is the editor's call, not the pipeline's.
const TOO_SMALL = /-(?:[1-9]\d?|1[01]\d)x(?:[1-9]\d?|1[01]\d)\.|\b(?:icon|favicon|sprite|75x75|100x100)\b|[?&](?:w|width)=(?:\d{1,2}|1[01]\d)\b/i;

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
 * Minimal sanity gate for the picture desk. Collect broadly: only clearly
 * non-photographic assets (charts, logos, screenshots, QR codes) are rejected
 * here. Subject, styling, orientation and quality are decided by the visual
 * safety screen and finally by the editor in the review desk.
 */
const NOT_A_PORTRAIT =
  /\b(?:chart|graph|infographic|scorecard|logo|wordmark|banner-?ad|screenshot|qr-?code|placeholder|map-?tile)\b/i;

/**
 * Low-quality asset cues in the URL: thumbnails, avatars, sprite sheets and
 * stamped/watermarked previews. Glamour intake wants the full-size frame.
 */
const LOW_QUALITY = /\b(?:thumb|thumbnail|tiny|icon|avatar|sprite|favicon|watermark|preview-?small|low-?res)\b/i;

/** Explicit small dimensions in the path or query (e.g. 150x150, w=120). */
function tooSmall(raw: string): boolean {
  const dims = raw.match(/(\d{2,4})\s*[x×]\s*(\d{2,4})/);
  if (dims) {
    const w = Number(dims[1]);
    const h = Number(dims[2]);
    if (w && h && (w < 320 || h < 320)) return true;
  }
  const width = raw.match(/[?&](?:w|width|resize)=(\d{2,4})/i);
  if (width && Number(width[1]) < 320) return true;
  return false;
}

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
  const readable = decodeURIComponent(path).replace(/[_%20+]/g, "-");
  if (NOT_A_PORTRAIT.test(readable)) return null;
  if (LOW_QUALITY.test(readable)) return null;
  if (tooSmall(ok)) return null;
  return ok;
}

