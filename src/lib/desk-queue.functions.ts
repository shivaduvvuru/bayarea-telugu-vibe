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

/** Records an editor decision on queue rows. Editorial desk only. */
export const setQueueStatus = createServerFn({ method: "POST" })
  .validator((data: { itemIds: string[]; status: string; deskToken?: string }) => {
    if (!["pending", "approved", "rejected"].includes(String(data?.status))) {
      throw new Error("Invalid status");
    }
    return {
      itemIds: (Array.isArray(data?.itemIds) ? data.itemIds : []).slice(0, 1000).map(String),
      status: String(data.status),
      deskToken: typeof data?.deskToken === "string" ? data.deskToken : undefined,
    };
  })
  .handler(async ({ data }) => {
    const { assertDesk } = await import("@/lib/desk-session.server");
    await assertDesk(data.deskToken);
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
    return { items: (rows ?? []) as unknown as DeskQueueRow[] };
  });
