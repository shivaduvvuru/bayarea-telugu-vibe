/**
 * Some publishers (notably Patch) expose only their own logo as the article
 * image, so every story ends up with the same picture. Reject those and let the
 * card fall back to its typographic tile instead.
 */
const BLOCKED =
  /(?:^|\.)patch\.com$|patch\.com|patchcdn|patch-?(?:am|logo)|logo|sprite|favicon|placeholder|default[-_]?(?:image|thumb)|avatar|blank\.|1x1|spacer|watermark/i;


export function usableImage(url: string | null | undefined): string | null {
  if (!url) return null;
  const raw = url.trim();
  if (!raw || BLOCKED.test(raw)) return null;
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
