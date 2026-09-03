/**
 * Brand-neutral localStorage keys.
 *
 * Keys used to be prefixed with the retired "batt-" brand. This helper returns
 * the current "tba-" key and copies a legacy value across once, so a returning
 * reader keeps their saved stories, favorites and hidden photos.
 */
export function brandKey(name: string) {
  const key = `tba-${name}`;
  if (typeof window === "undefined") return key;
  try {
    if (window.localStorage.getItem(key) === null) {
      const legacy = window.localStorage.getItem(`batt-${name}`);
      if (legacy !== null) window.localStorage.setItem(key, legacy);
    }
  } catch {
    /* storage can be unavailable; the key is still valid */
  }
  return key;
}
