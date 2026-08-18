import { createServerFn } from "@tanstack/react-start";

type QueueRow = {
  item_id: string;
  status: string;
  upload_status: string;
  uploaded_at: string | null;
  error: string | null;
};

/** Reads review-queue rows. Editorial desk only — the queue holds unpublished
 * and rejected content and must never be world-readable. */
export const listQueueRows = createServerFn({ method: "POST" })
  .validator((data: { itemIds?: string[]; deskToken?: string }) => ({
    itemIds: Array.isArray(data?.itemIds) ? data.itemIds.slice(0, 1000).map(String) : [],
    deskToken: typeof data?.deskToken === "string" ? data.deskToken : undefined,
  }))
  .handler(async ({ data }): Promise<{ rows: QueueRow[] }> => {
    const { assertDesk } = await import("@/lib/desk-session.server");
    await assertDesk(data.deskToken);
    if (!data.itemIds.length) return { rows: [] };
    const { admin } = await import("@/lib/cms.server");
    const db = await admin();
    const { data: rows, error } = await db
      .from("digest_queue")
      .select("item_id,status,upload_status,uploaded_at,error")
      .in("item_id", data.itemIds);
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as unknown as QueueRow[] };
  });

/** Records an editor decision on queue rows. Editorial desk only.
 * `reason: "duplicate"` behaves like a rejection (row leaves the desk and its
 * key is remembered) but is labelled so the audit list shows why it went. */
export const setQueueStatus = createServerFn({ method: "POST" })
  .validator((data: { itemIds: string[]; status: string; reason?: string; deskToken?: string }) => {
    if (!["pending", "approved", "rejected"].includes(String(data?.status))) {
      throw new Error("Invalid status");
    }
    return {
      itemIds: (Array.isArray(data?.itemIds) ? data.itemIds : []).slice(0, 1000).map(String),
      status: String(data.status),
      reason: data?.reason === "duplicate" ? "duplicate" : undefined,
      deskToken: typeof data?.deskToken === "string" ? data.deskToken : undefined,
    };
  })
  .handler(async ({ data }) => {
    const { assertDesk } = await import("@/lib/desk-session.server");
    await assertDesk(data.deskToken);
    if (!data.itemIds.length) return { updated: 0 };
    const { admin } = await import("@/lib/cms.server");
    const db = await admin();
    // Rejected stories leave the desk for good: remember their keys so the
    // collector never re-offers them, then delete the rows.
    if (data.status === "rejected") {
      const { data: rows } = await db
        .from("digest_queue")
        .select("item_id,dedupe_key,title")
        .in("item_id", data.itemIds);
      const keys = (rows ?? []).map((r) => ({
        dedupe_key: String((r as { dedupe_key?: string; item_id?: string }).dedupe_key ?? (r as { item_id?: string }).item_id ?? ""),
        item_id: String((r as { item_id?: string }).item_id ?? ""),
        title: data.reason === "duplicate"
          ? `[duplicate] ${(r as { title?: string }).title ?? ""}`.trim()
          : ((r as { title?: string }).title ?? null),
      })).filter((r) => r.dedupe_key);
      if (keys.length) {
        await db.from("digest_rejects").upsert(keys as never, { onConflict: "dedupe_key", ignoreDuplicates: true });
      }
      const { error: delError } = await db.from("digest_queue").delete().in("item_id", data.itemIds);
      if (delError) throw new Error(delError.message);
      return { updated: data.itemIds.length };
    }
    const { error } = await db
      .from("digest_queue")
      .update({ status: data.status } as never)
      .in("item_id", data.itemIds);
    if (error) throw new Error(error.message);
    return { updated: data.itemIds.length };
  });



type DeskQueueRow = {
  item_id: string;
  digest_date: string;
  kind: string;
  city_slug: string;
  title: string;
  summary: string | null;
  source: string | null;
  source_url: string | null;
  payload: Record<string, string | undefined> | null;
};

/**
 * Lists the review-desk backlog. The digest queue is staff-only under RLS, so
 * the passcode-gated desk must read it through this server function rather
 * than the browser client (which sees zero rows when nobody is signed in).
 */
export const listDeskItems = createServerFn({ method: "POST" })
  .validator((data: { days?: number; deskToken?: string }) => ({
    days: Math.min(Math.max(Number(data?.days) || 7, 1), 30),
    deskToken: typeof data?.deskToken === "string" ? data.deskToken : undefined,
  }))
  .handler(async ({ data }): Promise<{ items: DeskQueueRow[] }> => {
    const { assertDesk } = await import("@/lib/desk-session.server");
    await assertDesk(data.deskToken);
    const { admin } = await import("@/lib/cms.server");
    const db = await admin();
    const since = new Date(Date.now() - data.days * 86400000).toISOString().slice(0, 10);
    const { data: rows, error } = await db
      .from("digest_queue")
      .select("item_id,digest_date,kind,city_slug,title,summary,source,source_url,payload")
      .gte("digest_date", since)
      // A row can have been accidentally stamped as sent by an older pull
      // while its editorial decision is still pending. Pending work must
      // always remain visible to the reviewer.
      .or("upload_status.neq.sent,status.eq.pending")
      .order("digest_date", { ascending: false })
      // Match the collection endpoint's verification window so its confirmed
      // pending totals can be reconciled exactly by the desk.
      .limit(1000);
    if (error) throw new Error(error.message);
    const queue = (rows ?? []) as unknown as DeskQueueRow[];
    const legacyPictures = queue.flatMap((row) => {
      const payload = row.payload ?? {};
      const image = payload["image"];
      if (payload["review_type"] !== "picture" || payload["solo_verified"] === "visual-v1" || !image) {
        return [];
      }
      return [{ id: row.item_id, image }];
    });

    if (legacyPictures.length) {
      const { verifySoloWomanPhotos } = await import("@/lib/photo-subject.server");
      const accepted = await verifySoloWomanPhotos(
        legacyPictures,
        process.env["LOVABLE_API_KEY"],
      );
      const acceptedIds = legacyPictures.filter((item) => accepted.has(item.id)).map((item) => item.id);
      const rejectedIds = legacyPictures.filter((item) => !accepted.has(item.id)).map((item) => item.id);

      for (const row of queue) {
        if (!accepted.has(row.item_id)) continue;
        row.payload = { ...(row.payload ?? {}), solo_verified: "visual-v1" };
      }
      for (let offset = 0; offset < acceptedIds.length; offset += 100) {
        const ids = acceptedIds.slice(offset, offset + 100);
        const acceptedRows = queue.filter((row) => ids.includes(row.item_id));
        await Promise.all(
          acceptedRows.map((row) =>
            db
              .from("digest_queue")
              .update({ payload: row.payload } as never)
              .eq("item_id", row.item_id),
          ),
        );
      }
      for (let offset = 0; offset < rejectedIds.length; offset += 100) {
        await db.from("digest_queue").delete().in("item_id", rejectedIds.slice(offset, offset + 100));
      }
    }

    return {
      items: queue.filter((row) => {
        const payload = row.payload ?? {};
        return payload["review_type"] !== "picture" || payload["solo_verified"] === "visual-v1";
      }),
    };
  });
