/**
 * Glamour folder capacity + archive rotation.
 *
 * The picture collector runs every five minutes, so the Glamour folder would
 * grow without bound. Instead the folder holds a fixed number of live photos:
 * overflow is archived (never deleted) and archived photos come back after a
 * cooling period, most-liked first, whenever the folder has room.
 */

type Client = {
  from: (table: string) => any;
  rpc?: unknown;
};

/**
 * The folder works in pockets: a small live pocket keeps pages fast, and the
 * rest of the collection waits in the archive as further pockets. When the live
 * pocket has been fully used the next pocket is called in.
 */
export const POCKET_SIZE = 50;
/** Live photos kept in the Glamour folder at any time (one pocket). */
export const GALLERY_CAPACITY = POCKET_SIZE;
/** The folder must never hold fewer than this many live photos. */
export const GALLERY_MINIMUM = POCKET_SIZE;
/** Archived photos become eligible for re-entry after this many days. */
export const ARCHIVE_COOLDOWN_DAYS = 15;


const ARCHIVED = "archived";

type Row = { id: string; link_url: string | null; published_at: string | null; updated_at: string | null };

/** Slug the reader-facing app uses for a picture (mirrors article slugs). */
function slugOf(row: { link_url: string | null; id: string }): string {
  return row.link_url ?? row.id;
}

async function likesBySlug(client: Client, slugs: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!slugs.length) return out;
  const { data } = await client
    .from("photo_likes")
    .select("slug,likes")
    .in("slug", slugs.slice(0, 500));
  for (const r of (data ?? []) as { slug: string; likes: number }[]) out.set(r.slug, r.likes ?? 0);
  return out;
}

/**
 * Keeps the Glamour folder at capacity.
 * Returns how many photos were archived and how many were brought back.
 */
export async function rotateGalleryFolder(
  client: Client,
  capacity = GALLERY_CAPACITY,
): Promise<{ archived: number; restored: number; live: number }> {
  // 1) Current live folder, newest first.
  const { data: liveData, error: liveError } = await client
    .from("content_items")
    .select("id,link_url,published_at,updated_at")
    .eq("category", "gallery")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(1000);
  if (liveError) throw liveError;
  const live = (liveData ?? []) as Row[];

  let archived = 0;
  if (live.length > capacity) {
    // Overflow = oldest photos, but keep the ones readers liked most.
    const overflow = live.slice(capacity);
    const likes = await likesBySlug(client, overflow.map(slugOf));
    const doomed = [...overflow]
      .sort((a, b) => {
        const la = likes.get(slugOf(a)) ?? 0;
        const lb = likes.get(slugOf(b)) ?? 0;
        if (la !== lb) return la - lb; // least liked leaves first
        return (a.published_at ?? "").localeCompare(b.published_at ?? "");
      })
      .slice(0, overflow.length);
    const ids = doomed.map((r) => r.id);
    if (ids.length) {
      const { error } = await client
        .from("content_items")
        .update({ status: ARCHIVED } as never)
        .in("id", ids);
      if (error) throw error;
      archived = ids.length;
    }
  }

  // 2) Bring archived photos back when there is room and they have cooled off.
  const liveCount = live.length - archived;
  let restored = 0;
  const room = capacity - liveCount;
  if (room > 0) {
    // The folder must never fall below the minimum, so when it is short we
    // ignore the cooling period and pull back the best archived photos.
    const belowMinimum = liveCount < GALLERY_MINIMUM;
    const cutoff = new Date(Date.now() - ARCHIVE_COOLDOWN_DAYS * 86400000).toISOString();
    let query = client
      .from("content_items")
      .select("id,link_url,published_at,updated_at")
      .eq("category", "gallery")
      .eq("status", ARCHIVED);
    if (!belowMinimum) query = query.lt("updated_at", cutoff);
    const { data: archData } = await query.limit(1000);
    const pool = (archData ?? []) as Row[];
    if (pool.length) {
      const likes = await likesBySlug(client, pool.map(slugOf));
      const picks = [...pool]
        .sort((a, b) => {
          const la = likes.get(slugOf(a)) ?? 0;
          const lb = likes.get(slugOf(b)) ?? 0;
          if (la !== lb) return lb - la; // most liked returns first
          return (b.published_at ?? "").localeCompare(a.published_at ?? "");
        })
        .slice(0, room);
      const ids = picks.map((r) => r.id);
      if (ids.length) {
        const { error } = await client
          .from("content_items")
          .update({ status: "published", published_at: new Date().toISOString() } as never)
          .in("id", ids);
        if (error) throw error;
        restored = ids.length;
      }
    }
  }

  return { archived, restored, live: liveCount + restored };
}

/**
 * Calls in the next pocket: the current live pocket goes back to the archive
 * and up to `POCKET_SIZE` archived photos take its place, most-liked first.
 * Used when the reader-facing folder has been fully shown, so the site keeps a
 * small, fast live pocket instead of one huge folder.
 */
export async function swapGalleryPocket(
  client: Client,
  size = POCKET_SIZE,
): Promise<{ archived: number; restored: number; live: number }> {
  const { data: liveData, error: liveError } = await client
    .from("content_items")
    .select("id,link_url,published_at,updated_at")
    .eq("category", "gallery")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(1000);
  if (liveError) throw liveError;
  const live = (liveData ?? []) as Row[];

  // Candidate replacements first: never empty the folder when the archive has
  // nothing to offer.
  const { data: archData } = await client
    .from("content_items")
    .select("id,link_url,published_at,updated_at")
    .eq("category", "gallery")
    .eq("status", ARCHIVED)
    .order("updated_at", { ascending: true })
    .limit(1000);
  const pool = (archData ?? []) as Row[];
  if (!pool.length) return { archived: 0, restored: 0, live: live.length };

  const likes = await likesBySlug(client, pool.map(slugOf));
  const picks = [...pool]
    .sort((a, b) => {
      const la = likes.get(slugOf(a)) ?? 0;
      const lb = likes.get(slugOf(b)) ?? 0;
      if (la !== lb) return lb - la; // most liked returns first
      return (a.updated_at ?? "").localeCompare(b.updated_at ?? ""); // longest archived
    })
    .slice(0, size);

  let archived = 0;
  if (live.length) {
    const { error } = await client
      .from("content_items")
      .update({ status: ARCHIVED } as never)
      .in("id", live.map((r) => r.id));
    if (error) throw error;
    archived = live.length;
  }

  const { error: restoreError } = await client
    .from("content_items")
    .update({ status: "published", published_at: new Date().toISOString() } as never)
    .in("id", picks.map((r) => r.id));
  if (restoreError) throw restoreError;

  return { archived, restored: picks.length, live: picks.length };
}
