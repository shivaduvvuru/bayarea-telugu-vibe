/**
 * First-party newsroom hosts. The legacy partner editions were retired, so no
 * external host is treated as first-party any more; only links published on
 * timesbayarea.com count.
 */
const OWN_HOSTS = [/(^|\.)timesbayarea\.com$/i];

export function isOwnSiteLink(link: string | null | undefined): boolean {
  if (!link) return false;
  try {
    const host = new URL(link).hostname;
    return OWN_HOSTS.some((re) => re.test(host));
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
