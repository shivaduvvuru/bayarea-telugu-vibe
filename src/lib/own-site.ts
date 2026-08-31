/**
 * Our own newsrooms: the Bay Area edition (bayarea.telugutimes.net) and the
 * English national edition (www.telugutimes.net/en). Both are first-party
 * reporting, so their stories are trusted and are never relabelled into an
 * India / topic bucket by the regex classifiers.
 */
export function isOwnSiteLink(link: string | null | undefined): boolean {
  if (!link) return false;
  try {
    return /(^|\.)telugutimes\.net$/i.test(new URL(link).hostname);
  } catch {
    return false;
  }
}

/**
 * The section a first-party permalink names, e.g. "cinema", "events",
 * "temples". Returns null for links that are not ours. The English edition
 * prefixes every path with the language segment ("/en/..."), which is skipped.
 */
export function ownSiteSectionOf(link: string | null | undefined): string | null {
  if (!isOwnSiteLink(link)) return null;
  try {
    const parts = new URL(link!).pathname.split("/").filter(Boolean);
    const seg = (parts[0] === "en" || parts[0] === "te" ? parts[1] : parts[0])?.toLowerCase();
    return seg ?? null;
  } catch {
    return null;
  }
}
