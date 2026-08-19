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


/** One ingestion run's picture funnel, newest first. */
export type IngestionRun = {
  at: string;
  mode: string;
  trigger: string;
  discovered: number;
  noImage: number;
  imageUnusable: number;
  hardNews: number;
  candidates: number;
  screened: number;
  unscreenedPassed: number;
  safetyBlocked: number;
  duplicatesRemoved: number;
  toDesk: number;
  reasons: Record<string, number>;
  bySource: Record<string, { discovered: number; candidates: number }>;
  ok: boolean;
  error: string | null;
};

/**
 * Ingestion diagnostics for the review desk: the discovered -> screened ->
 * duplicate-removed -> review-desk funnel of the most recent collection runs,
 * with the exact rejection reason counts and per-source success rates.
 */
export const ingestionFunnel = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ runs: IngestionRun[]; recentRejects: { reason: string; count: number }[] }> => {
    const { admin } = await import("@/lib/cms.server");
    const db = await admin();

    const { data: runRows } = await db
      .from("collect_runs")
      .select("mode,trigger,funnel,ok,error,finished_at")
      .order("finished_at", { ascending: false })
      .limit(20);

    const runs: IngestionRun[] = ((runRows ?? []) as {
      mode: string;
      trigger: string;
      funnel: Record<string, unknown> | null;
      ok: boolean;
      error: string | null;
      finished_at: string;
    }[]).map((row) => {
      const f = (row.funnel ?? {}) as Record<string, number | undefined> & {
        reasons?: Record<string, number>;
        bySource?: Record<string, { discovered: number; candidates: number }>;
      };
      return {
        at: row.finished_at,
        mode: row.mode,
        trigger: row.trigger,
        discovered: f["discovered"] ?? 0,
        noImage: f["noImage"] ?? 0,
        imageUnusable: f["imageUnusable"] ?? 0,
        hardNews: f["hardNews"] ?? 0,
        candidates: f["candidates"] ?? 0,
        screened: f["screened"] ?? 0,
        unscreenedPassed: f["unscreenedPassed"] ?? 0,
        safetyBlocked: f["safetyBlocked"] ?? 0,
        duplicatesRemoved: f["duplicatesRemoved"] ?? 0,
        toDesk: f["deskPictures"] ?? f["toDesk"] ?? 0,
        reasons: f.reasons ?? {},
        bySource: f.bySource ?? {},
        ok: row.ok,
        error: row.error,
      };
    });

    const { data: rejectRows } = await db
      .from("digest_rejects")
      .select("reason,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    const tally = new Map<string, number>();
    for (const row of (rejectRows ?? []) as { reason: string | null }[]) {
      const key = row.reason ?? "unlabelled";
      tally.set(key, (tally.get(key) ?? 0) + 1);
    }

    return {
      runs,
      recentRejects: [...tally.entries()]
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count),
    };
  },
);

/**
 * Screens Glamour pictures for group shots and re-files any photo with two or
 * more people under Cinema/OTT, leaving only solo pictures in the folder.
 */
export const sweepGlamourSolo = createServerFn({ method: "POST" }).handler(async () => {
  const { sweepGlamourGroupPhotos } = await import("@/lib/glamour-solo-sweep.server");
  return sweepGlamourGroupPhotos(30);
});
