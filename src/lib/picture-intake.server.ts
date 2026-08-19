export const PICTURE_BUCKETS = [
  "usable",
  "pending",
  "approved",
  "rejected",
  "safety_blocked",
  "discovered",
] as const;

export type PictureBucket = (typeof PICTURE_BUCKETS)[number];

type Db = Awaited<ReturnType<typeof import("@/lib/cms.server")["admin"]>>;

export type PictureIntakeRow = {
  item_id: string;
  queue_item_id: string | null;
  stage: string;
  image_url: string;
  title: string;
  summary: string | null;
  source: string | null;
  source_url: string | null;
  city_slug: string | null;
  industry: string | null;
  star: string | null;
  event: string | null;
  safety_reason: string | null;
  screening_state: string;
  discovered_at: string;
};

export async function listPictureIntake(
  db: Db,
  input: { bucket: PictureBucket; page: number; pageSize: number },
) {
  const from = (input.page - 1) * input.pageSize;
  let query = db
    .from("picture_intake")
    .select(
      "item_id,queue_item_id,stage,image_url,title,summary,source,source_url,city_slug,industry,star,event,safety_reason,screening_state,discovered_at",
      { count: "exact" },
    );
  if (input.bucket === "usable") query = query.in("stage", ["usable", "pending"]);
  else if (input.bucket !== "discovered") query = query.eq("stage", input.bucket);
  const { data, error, count } = await query
    .order("updated_at", { ascending: false })
    .range(from, from + input.pageSize - 1);
  if (error) throw new Error(error.message);
  return { items: (data ?? []) as unknown as PictureIntakeRow[], total: count ?? 0 };
}

export async function pictureIntakeCounts(db: Db) {
  const stages = ["discovered", "usable", "pending", "approved", "rejected", "safety_blocked"];
  const pairs = await Promise.all(
    stages.map(async (stage) => {
      const { count, error } = await db
        .from("picture_intake")
        .select("item_id", { count: "exact", head: true })
        .eq("stage", stage);
      if (error) throw new Error(error.message);
      return [stage, count ?? 0] as const;
    }),
  );
  const counts = Object.fromEntries(pairs) as Record<string, number>;
  counts["usable"] = (counts["usable"] ?? 0) + (counts["pending"] ?? 0);
  counts["discovered"] = Object.values(counts).reduce((sum, value) => sum + value, 0) - counts["usable"];
  return counts;
}

export async function movePictureIntake(
  db: Db,
  input: { itemIds: string[]; stage: "pending" | "approved" | "rejected" | "duplicate" },
) {
  const { data: intakeRows, error: readError } = await db
    .from("picture_intake")
    .select("item_id,queue_item_id,dedupe_key,title,summary,source,source_url,city_slug,image_url,industry,star,event,metadata")
    .in("item_id", input.itemIds);
  if (readError) throw new Error(readError.message);
  const rows = (intakeRows ?? []) as unknown as Array<Record<string, unknown>>;

  if (input.stage === "pending") {
    const queueRows = rows.map((row) => ({
      item_id: String(row["queue_item_id"] ?? row["item_id"]),
      dedupe_key: row["dedupe_key"],
      digest_date: new Date().toISOString().slice(0, 10),
      kind: "news",
      city_slug: String(row["city_slug"] ?? "bay-area"),
      title: String(row["title"] ?? "Glamour photo"),
      summary: row["summary"],
      source: row["source"],
      source_url: row["source_url"],
      status: "pending",
      payload: {
        ...((row["metadata"] ?? {}) as Record<string, unknown>),
        image: row["image_url"],
        review_type: "picture",
        solo_verified: "editor-override",
        industry: row["industry"],
        star: row["star"],
        event: row["event"],
      },
    }));
    const { error } = await db.from("digest_queue").upsert(queueRows as never, { onConflict: "dedupe_key" });
    if (error) throw new Error(error.message);
  } else {
    const queueIds = rows.map((row) => String(row["queue_item_id"] ?? row["item_id"]));
    if (input.stage === "rejected" || input.stage === "duplicate") {
      const rejects = rows.map((row) => ({
        dedupe_key: String(row["dedupe_key"] ?? row["item_id"]),
        item_id: String(row["item_id"]),
        title: row["title"],
        reason: input.stage === "duplicate" ? "duplicate" : "editor_rejected",
      }));
      await db.from("digest_rejects").upsert(rejects as never, { onConflict: "dedupe_key" });
      await db.from("digest_queue").delete().in("item_id", queueIds);
    } else {
      const { error } = await db.from("digest_queue").update({ status: "approved" } as never).in("item_id", queueIds);
      if (error) throw new Error(error.message);
    }
  }

  const now = new Date().toISOString();
  const { error } = await db
    .from("picture_intake")
    .update({
      stage: input.stage,
      safety_reason: input.stage === "pending" ? null : undefined,
      screening_state: input.stage === "pending" ? "passed" : undefined,
      reviewed_at: input.stage === "pending" ? null : now,
    } as never)
    .in("item_id", input.itemIds);
  if (error) throw new Error(error.message);
  return { updated: input.itemIds.length };
}