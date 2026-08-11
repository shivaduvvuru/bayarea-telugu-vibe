/**
 * Some publishers (notably Patch) expose only their own logo as the article
 * image, so every story ends up with the same picture. Reject those and let the
 * card fall back to its typographic tile instead.
 */
const BLOCKED = /(?:^|\.)patch\.com$|patch\.com|patchcdn|patch-?(?:am|logo)/i;

export function usableImage(url: string | null | undefined): string | null {
  if (!url) return null;
  const raw = url.trim();
  if (!raw || BLOCKED.test(raw)) return null;
  return raw;
}
