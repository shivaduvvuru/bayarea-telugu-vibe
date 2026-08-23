import type {
  PropertyVideoRow,
  PropertyVideoStatus,
  PropertyVideoWithStats,
} from "@/lib/property-videos";

async function db() {
  const { admin } = await import("@/lib/cms.server");
  return admin();
}

const COLUMNS =
  "feature_id, project, developer, video_id, title, note, status, verified_at, updated_at";

/** Verified videos only — what readers may see. */
export async function readVerifiedVideos(): Promise<PropertyVideoRow[]> {
  const { data, error } = await (await db())
    .from("property_videos")
    .select(COLUMNS)
    .eq("status", "verified");
  if (error) throw new Error(error.message);
  return (data ?? []) as PropertyVideoRow[];
}

/** Desk view: every row plus its thumbnail click count. */
export async function readAllVideos(): Promise<PropertyVideoWithStats[]> {
  const client = await db();
  const [rows, clicks] = await Promise.all([
    client.from("property_videos").select(COLUMNS).order("updated_at", { ascending: false }),
    client.from("property_video_clicks").select("feature_id"),
  ]);
  if (rows.error) throw new Error(rows.error.message);
  const counts = new Map<string, number>();
  for (const c of (clicks.data ?? []) as { feature_id: string }[]) {
    counts.set(c.feature_id, (counts.get(c.feature_id) ?? 0) + 1);
  }
  return ((rows.data ?? []) as PropertyVideoRow[]).map((r) => ({
    ...r,
    clicks: counts.get(r.feature_id) ?? 0,
  }));
}

/** Public click totals per feature, so cards can show engagement. */
export async function readClickTotals(): Promise<Record<string, number>> {
  const { data, error } = await (await db())
    .from("property_video_clicks")
    .select("feature_id");
  if (error) throw new Error(error.message);
  const out: Record<string, number> = {};
  for (const row of (data ?? []) as { feature_id: string }[]) {
    out[row.feature_id] = (out[row.feature_id] ?? 0) + 1;
  }
  return out;
}

export type SaveVideoInput = {
  featureId: string;
  project: string;
  developer?: string | undefined;
  videoId: string;
  title?: string | undefined;
  note?: string | undefined;
  status: PropertyVideoStatus;
};

export async function saveVideo(input: SaveVideoInput) {
  const { error } = await (await db()).from("property_videos").upsert(
    {
      feature_id: input.featureId,
      project: input.project,
      developer: input.developer ?? null,
      video_id: input.videoId,
      title: input.title ?? null,
      note: input.note ?? null,
      status: input.status,
      verified_at: input.status === "verified" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "feature_id" },
  );
  if (error) throw new Error(error.message);
}

export async function setVideoStatus(featureId: string, status: PropertyVideoStatus) {
  const { error } = await (await db())
    .from("property_videos")
    .update({
      status,
      verified_at: status === "verified" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("feature_id", featureId);
  if (error) throw new Error(error.message);
}

export async function removeVideo(featureId: string) {
  const { error } = await (await db())
    .from("property_videos")
    .delete()
    .eq("feature_id", featureId);
  if (error) throw new Error(error.message);
}

export async function recordVideoClick(input: {
  featureId: string;
  videoId?: string | undefined;
  project?: string | undefined;
  path?: string | undefined;
}) {
  try {
    await (await db()).from("property_video_clicks").insert({
      feature_id: input.featureId,
      video_id: input.videoId ?? null,
      project: input.project ?? null,
      kind: "thumbnail_click",
      path: input.path ?? null,
    });
  } catch (err) {
    console.error("property video click failed", err);
  }
}
