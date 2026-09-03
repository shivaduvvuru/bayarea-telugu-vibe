/**
 * Single source of truth for where this edition is published.
 *
 * The public edition is canonical at https://timesbayarea.com. Preview builds
 * can override the origin with VITE_SITE_ORIGIN without touching route code.
 */
const rawOrigin =
  (import.meta.env['VITE_SITE_ORIGIN'] as string | undefined) ??
  "https://timesbayarea.com";

const rawBase = (import.meta.env['VITE_BASE_PATH'] as string | undefined) ?? "";

export const SITE_ORIGIN = rawOrigin.replace(/\/$/, "");
/** "" or "/bayarea" — never with a trailing slash. */
export const BASE_PATH = rawBase.replace(/\/$/, "");

/** Absolute, self-referencing canonical URL for an in-app path. */
export function canonical(path = "/") {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${BASE_PATH}${clean === "/" ? "/" : clean}`;
}

export const SITE_NAME = "Times Bay Area";
export const SITE_TAGLINE = "For Indian Community — What Matters Around You";
export const SITE_DESCRIPTION =
  "Local news, events, culture, food and community connections for Indian community members across the San Francisco Bay Area.";
export const HERITAGE_LINE =
  "From Telugu Times — serving the global Indian community since 2003.";
