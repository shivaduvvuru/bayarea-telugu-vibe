/**
 * Per-desk collection caps.
 *
 * The old collector used one flat TOPIC_MAX = 8 for every desk, which starved
 * Cinema/OTT: a single run could never publish more than a handful of items even
 * though it read dozens of publishers. Caps are now per desk, and — critically —
 * the desk total is applied AFTER classification and de-duplication, so a feed
 * full of Google News repeats cannot eat the whole allowance.
 */

export type DeskCapName = "cinema" | "micro-drama" | "news";

export type DeskCap = {
  /** Items kept for this desk per run, after classify + dedupe. */
  total: number;
  /** Items read from one publisher feed before we stop reading it. */
  perFeed: number;
  /** Items read from one Google News / search sweep query. */
  perSweepQuery: number;
  /** Photo-gallery listicles kept per run; they only fill leftover slots. */
  galleryMax: number;
  /** Items one source may occupy of this desk's total, for diversity. */
  perSource: number;
};

export const DESK_CAPS: Record<"cinema" | "micro-drama" | "default", DeskCap> = {
  cinema: { total: 40, perFeed: 12, perSweepQuery: 8, galleryMax: 3, perSource: 8 },
  "micro-drama": { total: 20, perFeed: 8, perSweepQuery: 8, galleryMax: 3, perSource: 8 },
  // news and every other desk keep the previous behaviour.
  default: { total: 8, perFeed: 8, perSweepQuery: 8, galleryMax: 3, perSource: 8 },
};

export function deskCap(desk: string | null | undefined): DeskCap {
  if (desk === "cinema") return DESK_CAPS.cinema;
  if (desk === "micro-drama") return DESK_CAPS["micro-drama"];
  return DESK_CAPS.default;
}

/**
 * Photo-gallery listicles ("Latest Photos", "In Pics") are legitimate cinema
 * traffic but crowd out reporting, so they are flagged and downranked.
 */
const GALLERY_TITLE = /latest photos|new photos|photo gallery|pics\s*:|in pics/i;

export function isGalleryTitle(title: string | null | undefined): boolean {
  return GALLERY_TITLE.test(title ?? "");
}


/** Fetch-time cap: stop reading a feed once its cap is hit. */
export function takeUpTo<T>(items: T[], cap: number): { items: T[]; capHit: boolean } {
  if (cap <= 0) return { items: [], capHit: items.length > 0 };
  return { items: items.slice(0, cap), capHit: items.length > cap };
}

function publishedMs(value: string | null | undefined): number {
  const t = value ? new Date(value).getTime() : Number.NaN;
  // Undated items sort last, so a cut drops them before dated ones.
  return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
}

/**
 * Desk total: order newest-first by published date and keep the top `total`,
 * so the cut drops the oldest items rather than whichever feed was read last.
 */
export function capByRecency<T extends { published_at?: string | null; published?: string | null }>(
  items: T[],
  total: number,
): { kept: T[]; dropped: T[] } {
  const ordered = [...items].sort(
    (a, b) =>
      publishedMs(b.published_at ?? b.published) - publishedMs(a.published_at ?? a.published),
  );
  return { kept: ordered.slice(0, Math.max(0, total)), dropped: ordered.slice(Math.max(0, total)) };
}

export type DeskFunnel = {
  fetched: number;
  after_classify: number;
  after_dedupe: number;
  after_cap: number;
  cap_dropped: number;
};

export function emptyFunnel(): DeskFunnel {
  return { fetched: 0, after_classify: 0, after_dedupe: 0, after_cap: 0, cap_dropped: 0 };
}
