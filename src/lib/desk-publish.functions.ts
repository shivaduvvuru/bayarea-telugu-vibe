import { createServerFn } from "@tanstack/react-start";

type Input = { itemIds?: string[] };

/**
 * Publishes approved desk rows into the site's own newsroom store and records
 * the outcome on the queue row (queued -> sent, or failed + error).
 */
export const publishApproved = createServerFn({ method: "POST" })
  .inputValidator((data: Input) => ({
    itemIds: Array.isArray(data?.itemIds) ? data.itemIds.slice(0, 500).map(String) : undefined,
  }))
  .handler(async ({ data }) => {
    const { ingest, admin } = await import("@/lib/cms.server");
    const { deskRowToIngest } = await import("@/lib/desk-publish.server");
    const db = await admin();

    let query = db
      .from("digest_queue")
      .select("*")
      .eq("status", "approved")
      .neq("upload_status", "sent")
      .limit(500);
    if (data.itemIds?.length) query = query.in("item_id", data.itemIds);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return { sent: 0, error: null as string | null };

    const ids = rows.map((r) => (r as { item_id: string }).item_id);
    await db.from("digest_queue").update({ upload_status: "queued" }).in("item_id", ids);

    try {
      await ingest(rows.map((r) => deskRowToIngest(r as Record<string, unknown>)));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await db
        .from("digest_queue")
        .update({ upload_status: "failed", error: message })
        .in("item_id", ids);
      return { sent: 0, error: message };
    }

    await db
      .from("digest_queue")
      .update({ upload_status: "sent", uploaded_at: new Date().toISOString(), error: null })
      .in("item_id", ids);

    return { sent: ids.length, error: null as string | null };
  });
