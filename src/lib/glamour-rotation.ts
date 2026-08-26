/**
 * Nightly Glamour rotation order.
 *
 * The folder is displayed least-recently-shown-first: pictures nobody has been
 * shown yet lead, then the ones seen longest ago, and inside those bands the
 * order is shuffled with a per-day seed. Because the seed changes at midnight
 * Pacific, today's order is a genuinely different arrangement instead of
 * yesterday's list rotated by one — and a final pass moves any picture that
 * would land on the same position as yesterday.
 */

export type RotatableRow = {
  id: string;
  published_at?: string | null;
  last_shown_at?: string | null;
};

/** Deterministic small PRNG, so SSR and the client agree on today's order. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Day number in Pacific time — the folder turns over with the site's day. */
export function glamourDaySeed(now = new Date()): number {
  const pacific = new Date(now.getTime() - 8 * 3_600_000);
  return Math.floor(pacific.getTime() / 86_400_000);
}

function shuffle<T>(items: T[], next: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Shuffles inside sliding windows so the recency bias survives the shuffle. */
function windowedShuffle<T>(items: T[], size: number, next: () => number): T[] {
  const out: T[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...shuffle(items.slice(i, i + size), next));
  }
  return out;
}

function orderFor<T extends RotatableRow>(rows: T[], seed: number): T[] {
  const next = rng(seed);
  const unseen = rows
    .filter((r) => !r.last_shown_at)
    .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
  const seen = rows
    .filter((r) => !!r.last_shown_at)
    .sort((a, b) => (a.last_shown_at ?? "").localeCompare(b.last_shown_at ?? ""));
  // Fresh / never-seen pictures fill the first screenful, fully shuffled.
  // Everything after keeps least-recently-seen first, shuffled in short windows.
  return [...shuffle(unseen, next), ...windowedShuffle(seen, 6, next)];
}

/**
 * Today's display order for the Glamour folder.
 * No picture keeps the position it held in yesterday's order.
 */
export function glamourRotation<T extends RotatableRow>(
  rows: T[],
  seed = glamourDaySeed(),
): T[] {
  if (rows.length < 2) return [...rows];
  const today = orderFor(rows, seed);
  const yesterday = orderFor(rows, seed - 1);
  const next = rng(seed ^ 0x9e3779b9);
  for (let i = 0; i < today.length; i += 1) {
    if (today[i]!.id !== yesterday[i]?.id) continue;
    // Same slot two days running: swap it with another slot that stays clean.
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const j = Math.floor(next() * today.length);
      if (j === i) continue;
      if (today[j]!.id === yesterday[i]?.id || today[i]!.id === yesterday[j]?.id) continue;
      [today[i], today[j]] = [today[j]!, today[i]!];
      break;
    }
  }
  return today;
}
