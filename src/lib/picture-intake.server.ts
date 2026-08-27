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
 * Bulk approval. Set-based: one intake read, one queue upsert that returns both
 * inserted and pre-existing rows (so no second lookup is needed and an
 * already-queued picture counts as a success), one publish call, and a status
 * update restricted to the pictures that actually resolved to a queue row.
 * Counts can therefore never shift while the response reports 0 approved.
 */
export async function bulkApprovePictures(
  db: Db,
  itemIds: string[],
): Promise<{ approved: number; failed: Array<{ item_id: string; reason: string }>; error: string | null }> {
  if (!itemIds.length) return { approved: 0, failed: [], error: null };
  try {
    const { data: intakeRows, error: readError } = await db
      .from("picture_intake")
      .select("item_id,queue_item_id,dedupe_key,title,summary,source,source_url,city_slug,image_url,industry,star,event,metadata")
      .in("item_id", itemIds);
    if (readError) throw new Error(readError.message);
    const rows = (intakeRows ?? []) as unknown as Array<Record<string, unknown>>;
    const found = new Set(rows.map((r) => String(r["item_id"])));

    const queueIdOf = (row: Record<string, unknown>) => String(row["queue_item_id"] ?? row["item_id"]);
    const keyOf = (row: Record<string, unknown>) => String(row["dedupe_key"] ?? row["item_id"]);

    const payloads = rows.map((row) => ({
      item_id: queueIdOf(row),
      dedupe_key: keyOf(row),
      digest_date: new Date().toISOString().slice(0, 10),
      kind: "news",
      city_slug: String(row["city_slug"] ?? "bay-area"),
      title: String(row["title"] ?? "Glamour photo"),
      summary: row["summary"],
      source: row["source"],
      source_url: row["source_url"],
      status: "approved",
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

    let queueRows: Array<Record<string, unknown>> = [];
    if (payloads.length) {
      // The queue's only unique key is item_id (dedupe_key has no unique
      // constraint, which is why the old dedupe_key upsert failed outright).
      // Queue ids are derived from the picture, so a re-approval lands on the
      // same row and the returned set contains both new and pre-existing rows.
      const { data: upserted, error } = await db
        .from("digest_queue")
        .upsert(payloads as never, { onConflict: "item_id" })
        .select("*");
      if (error) throw new Error(error.message);
      queueRows = (upserted ?? []) as unknown as Array<Record<string, unknown>>;
    }

    // Resolve each picture to its queue row by queue id, falling back to the
    // dedupe key for legacy rows queued under a different id.
    const byKey = new Map(
      queueRows.filter((r) => r["dedupe_key"]).map((r) => [String(r["dedupe_key"]), r]),
    );
    const byId = new Map(queueRows.map((r) => [String(r["item_id"]), r]));


    const resolvedPictureIds: string[] = [];
    const resolvedQueue = new Map<string, Record<string, unknown>>();
    const failed: Array<{ item_id: string; reason: string }> = [];

    for (const id of itemIds) {
      if (!found.has(id)) {
        failed.push({ item_id: id, reason: "picture no longer in intake" });
        continue;
      }
      const row = rows.find((r) => String(r["item_id"]) === id)!;
      const queue = byKey.get(keyOf(row)) ?? byId.get(queueIdOf(row));
      if (!queue) {
        failed.push({ item_id: id, reason: "no review-queue row could be created" });
        continue;
      }
      resolvedPictureIds.push(id);
      resolvedQueue.set(String(queue["item_id"]), queue);
    }

    // Publish everything not already live. Rows already marked sent stay approved.
    const toPublish = [...resolvedQueue.values()].filter((r) => r["upload_status"] !== "sent");
    if (toPublish.length) {
      const { ingest } = await import("@/lib/cms.server");
      const { deskRowToIngest } = await import("@/lib/desk-publish.server");
      await ingest(toPublish.map((r) => deskRowToIngest(r)), { skipGuard: true });
      await db
        .from("digest_queue")
        .update({ upload_status: "sent", uploaded_at: new Date().toISOString(), error: null })
        .in("item_id", toPublish.map((r) => String(r["item_id"])));
    }

    // Only pictures that reached a queue row change stage.
    if (resolvedPictureIds.length) {
      const { error } = await db
        .from("picture_intake")
        .update({ stage: "approved", reviewed_at: new Date().toISOString() } as never)
        .in("item_id", resolvedPictureIds);
      if (error) throw new Error(error.message);
    }

    return { approved: resolvedPictureIds.length, failed, error: null };
  } catch (caught) {
    console.error("[bulkApprovePictures] failed", caught);
    return {
      approved: 0,
      failed: itemIds.map((id) => ({ item_id: id, reason: describe(caught) })),
      error: describe(caught),
    };
  }
}

/** Readable reason for anything thrown, including Response and plain objects. */
function describe(caught: unknown): string {
  if (caught instanceof Error) return caught.message;
  if (caught instanceof Response) return `HTTP ${caught.status} ${caught.statusText}`;
  try {
    return `bulk approval failed: ${JSON.stringify(caught)}`;
  } catch {
    return "bulk approval failed";
  }
}

