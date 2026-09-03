/**
 * Recovery for stale bundle chunks.
 *
 * When a new build deploys, the hashed asset a still-open tab asks for stops
 * existing and lazy route imports fail with "Failed to fetch dynamically
 * imported module". A single hard reload picks up the new manifest; the
 * sessionStorage guard makes sure a genuinely broken chunk cannot loop.
 */

const GUARD_KEY = "vite-chunk-reload-guard";
const GUARD_WINDOW_MS = 30_000;

const CHUNK_ERROR = /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Loading chunk \d+ failed|Loading CSS chunk/i;

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const message =
    typeof error === "string"
      ? error
      : String((error as { message?: unknown }).message ?? error);
  return CHUNK_ERROR.test(message);
}

/**
 * Reloads once per session window when the error is a stale-chunk failure.
 * Returns true when a reload was triggered, so callers can keep showing a
 * neutral state instead of an error screen.
 */
export function recoverFromChunkError(error: unknown): boolean {
  if (typeof window === "undefined" || !isChunkLoadError(error)) return false;
  try {
    const last = Number(window.sessionStorage.getItem(GUARD_KEY) ?? 0);
    if (Date.now() - last < GUARD_WINDOW_MS) return false;
    window.sessionStorage.setItem(GUARD_KEY, String(Date.now()));
  } catch {
    /* private mode: still worth one reload attempt */
  }
  window.location.reload();
  return true;
}
