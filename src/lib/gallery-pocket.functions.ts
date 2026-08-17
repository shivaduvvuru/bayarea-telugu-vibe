import { createServerFn } from "@tanstack/react-start";

export type PocketSwap = { archived: number; restored: number; live: number; skipped?: boolean };

/**
 * Calls in the next archived pocket of Glamour photos.
 *
 * The reader-facing site keeps only a small live pocket (about 50 pictures) so
 * pages stay fast; when every photo in that pocket has been shown the site asks
 * for the next pocket. Throttled: a pocket has to be at least a few minutes old
 * before it can be swapped again, so a burst of readers cannot thrash the folder.
 */
export const swapGlamourPocket = createServerFn({ method: "POST" }).handler(
  async (): Promise<PocketSwap> => {
    const { admin } = await import("@/lib/cms.server");
    const { swapGalleryPocket } = await import("@/lib/gallery-archive.server");
    const db = await admin();

    const { data: newest } = await db
      .from("content_items")
      .select("published_at")
      .eq("category", "gallery")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(1);
    const stamp = ((newest ?? [])[0] as { published_at: string | null } | undefined)?.published_at;
    if (stamp && Date.now() - new Date(stamp).getTime() < 3 * 60_000) {
      return { archived: 0, restored: 0, live: 0, skipped: true };
    }

    return swapGalleryPocket(db as never);
  },
);
