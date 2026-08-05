/**
 * Single source of truth for where this edition is published.
 *
 * Today the app is served at the Lovable preview origin. The target
 * production location is https://www.telugutimes.net/bayarea/ — set
 * VITE_SITE_ORIGIN and VITE_BASE_PATH at build time to move it there
 * without touching route code. See docs/deployment-bayarea.md.
 */
const rawOrigin =
  (import.meta.env['VITE_SITE_ORIGIN'] as string | undefined) ??
  "https://bayarea-telugu-vibe.lovable.app";

const rawBase = (import.meta.env['VITE_BASE_PATH'] as string | undefined) ?? "";

export const SITE_ORIGIN = rawOrigin.replace(/\/$/, "");
/** "" or "/bayarea" — never with a trailing slash. */
export const BASE_PATH = rawBase.replace(/\/$/, "");

/** Absolute, self-referencing canonical URL for an in-app path. */
export function canonical(path = "/") {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${BASE_PATH}${clean === "/" ? "/" : clean}`;
}

export const SITE_NAME = "Bay Area Telugu Times";
export const SITE_TAGLINE = "Our Bay. Our Voice.";
export const SITE_DESCRIPTION =
  "Local news, events, culture, food and community connections for Telugu people across the San Francisco Bay Area.";
export const HERITAGE_LINE =
  "From Telugu Times — serving the global Telugu community since 2003.";
export const PARENT_SITE = "https://www.telugutimes.net";