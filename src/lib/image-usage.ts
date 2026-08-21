/**
 * Central image-use registry.
 *
 * Every picture the homepage shows in an editorial slot is logged here with the
 * section it appeared in, when it was last used and how many times it has run.
 * Selection code reads this log so photographs have a lifecycle instead of being
 * interchangeable decoration:
 *
 *  - hero images do not return to the hero for 7 days
 *  - feature-card images rest for 4 days
 *  - the same image is never used twice on one page render
 *
 * The log lives in localStorage (browser-only, read synchronously through a
 * module cache) so no database migration is needed and picking an image never
 * costs a re-render.
 */

const KEY = "tba-image-usage";
const DAY_MS = 24 * 60 * 60 * 1000;
const LIMIT = 1200;

/** Editorial slots that share the registry. */
export type UseSection = "hero" | "feature" | "grid";

/** How long an image rests before it may return to the same kind of slot. */
export const REST_MS: Record<UseSection, number> = {
  hero: 7 * DAY_MS,
  feature: 4 * DAY_MS,
  grid: 12 * 60 * 60 * 1000,
};

export type UsageRecord = {
  /** Last time this image was displayed anywhere. */
  last: number;
  /** Total impressions we have recorded. */
  uses: number;
  /** Section it was last displayed in. */
  section: UseSection;
  /** Last time it was used per section. */
  bySection: Partial<Record<UseSection, number>>;
  /** Coarse subject tag, used for visual-diversity checks. */
  subject?: string | undefined;
};

type Log = Record<string, UsageRecord>;

let cache: Log | null = null;

function load(): Log {
  if (cache) return cache;
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Log) : {};
    const cutoff = Date.now() - 30 * DAY_MS;
    cache = Object.fromEntries(
      Object.entries(parsed).filter(([, r]) => r && typeof r.last === "number" && r.last > cutoff),
    );
  } catch {
    cache = {};
  }
  return cache;
}

function persist(log: Log) {
  cache = log;
  if (typeof window === "undefined") return;
  try {
    const entries = Object.entries(log)
      .sort((a, b) => b[1].last - a[1].last)
      .slice(0, LIMIT);
    cache = Object.fromEntries(entries);
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Storage blocked: the in-memory log still guards this session.
  }
}

export function usageOf(image: string): UsageRecord | undefined {
  return load()[image];
}

/** When the image last ran, optionally within one section (0 = never). */
export function lastUsed(image: string, section?: UseSection): number {
  const record = load()[image];
  if (!record) return 0;
  return section ? (record.bySection?.[section] ?? 0) : record.last;
}

export function timesUsed(image: string): number {
  return load()[image]?.uses ?? 0;
}

/** True while the image is still resting from its last run in this section. */
export function isResting(image: string, section: UseSection, now = Date.now()): boolean {
  return lastUsed(image, section) > now - REST_MS[section];
}

/** Records that an image is on screen in a slot. */
export function noteUse(image: string, section: UseSection, subject?: string) {
  if (!image) return;
  const log = load();
  const now = Date.now();
  const previous = log[image];
  // Re-stamping inside a minute is pointless write traffic.
  if (previous && now - (previous.bySection?.[section] ?? 0) < 60_000) return;
  persist({
    ...log,
    [image]: {
      last: now,
      uses: (previous?.uses ?? 0) + 1,
      section,
      bySection: { ...(previous?.bySection ?? {}), [section]: now },
      subject: subject ?? previous?.subject,
    },
  });
}

/**
 * Images already claimed by an earlier slot in this page render. Reset on every
 * navigation/reload, so one photograph is never printed twice on the homepage.
 */
const pageClaims = new Set<string>();

export function claimForPage(image: string): boolean {
  if (!image || pageClaims.has(image)) return false;
  pageClaims.add(image);
  return true;
}

export function isClaimedOnPage(image: string): boolean {
  return pageClaims.has(image);
}

export function resetPageClaims() {
  pageClaims.clear();
}
