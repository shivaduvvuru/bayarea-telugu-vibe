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
  .inputValidator((data: { itemIds?: string[] }) => ({
    itemIds: Array.isArray(data?.itemIds) ? data.itemIds.slice(0, 1000).map(String) : [],
  }))
  .handler(async ({ data }): Promise<QueueRow[]> => {
    const { assertDesk } = await import("@/lib/desk-session.server");
    await assertDesk();
    if (!data.itemIds.length) return [];
    const { admin } = await import("@/lib/cms.server");
    const db = await admin();
    const { data: rows, error } = await db
      .from("digest_queue")
      .select("item_id,status,upload_status,uploaded_at,error")
      .in("item_id", data.itemIds);
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as QueueRow[];
  });

const STATUSES = new Set(["pending", "approved", "rejected"]);

/** Records an editor decision on queue rows. Editorial desk only. */
export const setQueueStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { itemIds: string[]; status: string }) => {
    if (!STATUSES.has(String(data?.status))) throw new Error("Invalid status");
    return {
      itemIds: (Array.isArray(data?.itemIds) ? data.itemIds : []).slice(0, 1000).map(String),
      status: String(data.status),
    };
  })
  .handler(async ({ data }) => {
    const { assertDesk } = await import("@/lib/desk-session.server");
    await assertDesk();
    if (!data.itemIds.length) return { updated: 0 };
    const { admin } = await import("@/lib/cms.server");
    const db = await admin();
    const { error } = await db
      .from("digest_queue")
      .update({ status: data.status } as never)
      .in("item_id", data.itemIds);
    if (error) throw new Error(error.message);
    return { updated: data.itemIds.length };
  });
