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
  // Ready for Review is single-woman glamour only: a photo appears here only
  // after the visual screen confirmed exactly one adult woman in the frame.
  if (input.bucket === "usable")
    query = query.in("stage", ["usable", "pending"]).eq("screening_state", "passed");
  else if (input.bucket !== "discovered") query = query.eq("stage", input.bucket);

  const { data, error, count } = await query
    .order("updated_at", { ascending: false })
    .range(from, from + input.pageSize - 1);
  if (error) throw new Error(error.message);
  return { items: (data ?? []) as unknown as PictureIntakeRow[], total: count ?? 0 };
}

export async function pictureIntakeCounts(db: Db) {
  const stages = ["usable", "pending", "approved", "rejected", "safety_blocked"];
  const [pairs, allResult] = await Promise.all([
    Promise.all(stages.map(async (stage) => {
      let q = db
        .from("picture_intake")
        .select("item_id", { count: "exact", head: true })
        .eq("stage", stage);
      // Ready for Review counts only verified single-woman photos.
      if (stage === "usable" || stage === "pending") q = q.eq("screening_state", "passed");
      const { count, error } = await q;
      if (error) throw new Error(error.message);
      return [stage, count ?? 0] as const;
    })),
    db.from("picture_intake").select("item_id", { count: "exact", head: true }),
  ]);
  if (allResult.error) throw new Error(allResult.error.message);
  const counts = Object.fromEntries(pairs) as Record<string, number>;
  counts["usable"] = (counts["usable"] ?? 0) + (counts["pending"] ?? 0);

  counts["discovered"] = allResult.count ?? 0;
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

  if (input.stage === "pending" || input.stage === "approved") {
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
      status: input.stage,
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
/**
 * Bulk approval. Set-based only: one intake read, one queue upsert, one publish
 * insert, one status update — no per-picture loop and no image fetching (artwork
 * is already stored at intake). Large selections therefore finish inside a
 * single request instead of running past the request limit.
 */
export async function bulkApprovePictures(
  db: Db,
  itemIds: string[],
): Promise<{ approved: number; failed: string[]; error: string | null }> {
  if (!itemIds.length) return { approved: 0, failed: [], error: null };
  try {
    await movePictureIntake(db, { itemIds, stage: "approved" });

    const { data: intake } = await db
      .from("picture_intake")
      .select("item_id,queue_item_id")
      .in("item_id", itemIds);
    const queueIds = ((intake ?? []) as Array<{ item_id: string; queue_item_id: string | null }>).map(
      (r) => r.queue_item_id ?? r.item_id,
    );
    if (!queueIds.length) return { approved: 0, failed: itemIds, error: null };

    const { data: rows, error } = await db
      .from("digest_queue")
      .select("*")
      .in("item_id", queueIds)
      .eq("status", "approved")
      .neq("upload_status", "sent");
    if (error) throw new Error(error.message);
    const queueRows = (rows ?? []) as unknown as Array<Record<string, unknown>>;
    if (!queueRows.length) return { approved: 0, failed: itemIds, error: null };

    const { ingest } = await import("@/lib/cms.server");
    const { deskRowToIngest } = await import("@/lib/desk-publish.server");
    await ingest(queueRows.map((r) => deskRowToIngest(r)), { skipGuard: true });

    const sentIds = queueRows.map((r) => String(r["item_id"]));
    await db
      .from("digest_queue")
      .update({ upload_status: "sent", uploaded_at: new Date().toISOString(), error: null })
      .in("item_id", sentIds);

    const publishedQueue = new Set(sentIds);
    const failed = ((intake ?? []) as Array<{ item_id: string; queue_item_id: string | null }>)
      .filter((r) => !publishedQueue.has(r.queue_item_id ?? r.item_id))
      .map((r) => r.item_id);
    return { approved: sentIds.length, failed, error: null };
  } catch (caught) {
    return {
      approved: 0,
      failed: itemIds,
      error: caught instanceof Error ? caught.message : `Bulk approval failed: ${JSON.stringify(caught)}`,
    };
  }
}
