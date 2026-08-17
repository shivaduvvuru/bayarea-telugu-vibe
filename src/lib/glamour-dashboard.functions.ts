import { createServerFn } from "@tanstack/react-start";

export type GlamourPhoto = {
  id: string;
  title: string;
  image_url: string | null;
  link_url: string | null;
  status: "published" | "archived" | string;
  solo: boolean;
  likes: number;
  published_at: string | null;
  updated_at: string | null;
};

export type GlamourDashboard = {
  photos: GlamourPhoto[];
  live: number;
  archived: number;
  pending: number;
  solo: number;
  nonSolo: number;
  capacity: number;
  minimum: number;
  cadenceMinutes: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
};

/**
 * Snapshot of the Glamour folder for the editor dashboard: every live and
 * archived picture with its solo-woman status, plus the continuous picture
 * collector's last and next run.
 */
export const glamourDashboard = createServerFn({ method: "POST" }).handler(
  async (): Promise<GlamourDashboard> => {
    const { admin } = await import("@/lib/cms.server");
    const { GALLERY_CAPACITY, GALLERY_MINIMUM } = await import("@/lib/gallery-archive.server");
    const { isSingleWoman } = await import("@/lib/cinema-topics");
    const db = await admin();

    const { data: rows } = await db
      .from("content_items")
      .select("id,title,summary,image_url,link_url,status,published_at,updated_at")
      .eq("category", "gallery")
      .in("status", ["published", "archived", "pending"])
      .order("published_at", { ascending: false })
      .limit(1000);

    const items = (rows ?? []) as {
      id: string;
      title: string;
      summary: string | null;
      image_url: string | null;
      link_url: string | null;
      status: string;
      published_at: string | null;
      updated_at: string | null;
    }[];

    const slugs = items.map((r) => r.link_url ?? r.id).slice(0, 500);
    const likes = new Map<string, number>();
    if (slugs.length) {
      const { data: likeRows } = await db.from("photo_likes").select("slug,likes").in("slug", slugs);
      for (const r of (likeRows ?? []) as { slug: string; likes: number }[]) {
        likes.set(r.slug, r.likes ?? 0);
      }
    }

    const photos: GlamourPhoto[] = items.map((r) => ({
      id: r.id,
      title: r.title,
      image_url: r.image_url,
      link_url: r.link_url,
      status: r.status,
      solo: isSingleWoman(r.title, r.summary, r.link_url),
      likes: likes.get(r.link_url ?? r.id) ?? 0,
      published_at: r.published_at,
      updated_at: r.updated_at,
    }));

    const { data: runRows } = await db
      .from("collect_runs")
      .select("finished_at")
      .eq("mode", "gallery")
      .order("finished_at", { ascending: false })
      .limit(1);
    const lastRunAt = ((runRows ?? [])[0] as { finished_at: string } | undefined)?.finished_at ?? null;

    // The picture collector runs continuously, once a minute.
    const cadenceMinutes = 1;
    const nextRunAt = new Date(
      (lastRunAt ? new Date(lastRunAt).getTime() : Date.now()) + cadenceMinutes * 60_000,
    ).toISOString();

    return {
      photos,
      live: photos.filter((p) => p.status === "published").length,
      archived: photos.filter((p) => p.status === "archived").length,
      pending: photos.filter((p) => p.status === "pending").length,
      solo: photos.filter((p) => p.solo).length,
      nonSolo: photos.filter((p) => !p.solo).length,
      capacity: GALLERY_CAPACITY,
      minimum: GALLERY_MINIMUM,
      cadenceMinutes,
      lastRunAt,
      nextRunAt,
    };
  },
);
