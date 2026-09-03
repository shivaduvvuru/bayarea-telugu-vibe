import { brandKey } from "@/lib/local-key";
/**
 * Seven-day memory of the pictures the full-size slots have already shown.
 *
 * Baseline rule: a Glamour photo that took a full-size slot does not come back
 * for a week. The log lives in localStorage so it survives reloads, and is read
 * synchronously (module cache) so picking a photo never needs a re-render.
 */
const KEY = brandKey("photo-shown");
/** A picture shown in a full-size slot is off the rotation for this long. */
export const SHOWN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** Enough for a week of 20-second cycles worth of distinct photos. */
const LIMIT = 800;

type ShownLog = Record<string, number>;

let cache: ShownLog | null = null;

function load(): ShownLog {
  if (cache) return cache;
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as ShownLog) : {};
    const cutoff = Date.now() - SHOWN_WINDOW_MS;
    cache = Object.fromEntries(
      Object.entries(parsed).filter(([, at]) => typeof at === "number" && at > cutoff),
    );
  } catch {
    cache = {};
  }
  return cache;
}

function persist(log: ShownLog) {
  cache = log;
  if (typeof window === "undefined") return;
  try {
    const entries = Object.entries(log).sort((a, b) => b[1] - a[1]).slice(0, LIMIT);
    cache = Object.fromEntries(entries);
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Storage full or blocked: the in-memory log still guards this session.
  }
}

/** When this picture last held a full-size slot, or 0 if not in the last week. */
export function shownAt(picture: string): number {
  return load()[picture] ?? 0;
}

/** True while the picture is inside its one-week cooldown. */
export function shownThisWeek(picture: string): boolean {
  return shownAt(picture) > Date.now() - SHOWN_WINDOW_MS;
}

/** Records that a full-size slot is showing this picture right now. */
export function markShown(picture: string) {
  const log = load();
  const now = Date.now();
  // Re-stamping the same photo inside one cycle is pointless write traffic.
  if (now - (log[picture] ?? 0) < 60_000) return;
  persist({ ...log, [picture]: now });
}
