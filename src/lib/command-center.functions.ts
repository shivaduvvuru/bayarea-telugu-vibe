import { createServerFn } from "@tanstack/react-start";

/**
 * Times Bay Area Command Center server functions.
 *
 * All of these are staff operations, gated by the same editorial desk passcode
 * session used by /desk (see desk-session.server.ts). They run with the service
 * role, so the gate is checked first on every call.
 */

type Gate = { deskToken?: string };

async function requireDesk(deskToken?: string) {
  const { verifyDeskToken, deskUnlocked } = await import("@/lib/desk-session.server");
  if (deskToken && verifyDeskToken(deskToken)) return;
  if (await deskUnlocked()) return;
  throw new Error("Desk locked");
}

export type SourceInput = {
  id?: string;
  name: string;
  source_url?: string | null;
  rss_url?: string | null;
  api_url?: string | null;
  source_class: string;
  connector_type: string;
  confidence: string;
  cities: string[];
  topics: string[];
  frequency_minutes: number;
  active: boolean;
  notes?: string | null;
};

export const listRegistry = createServerFn({ method: "GET" })
  .inputValidator((data: Gate) => data)
  .handler(async ({ data }) => {
    await requireDesk(data.deskToken);
    const { admin } = await import("@/lib/ingest.server");
    const db = await admin();
    const [sources, cities, topics] = await Promise.all([
      db.from("content_sources").select("*").order("name"),
      db.from("cities").select("*").order("sort_order"),
      db.from("topics").select("*").order("sort_order"),
    ]);
    return {
      sources: sources.data ?? [],
      cities: cities.data ?? [],
      topics: topics.data ?? [],
      error: sources.error?.message ?? null,
    };
  });

export const saveSource = createServerFn({ method: "POST" })
  .inputValidator((data: Gate & { source: SourceInput }) => data)
  .handler(async ({ data }) => {
    await requireDesk(data.deskToken);
    const { admin } = await import("@/lib/ingest.server");
    const db = await admin();
    const { id, ...fields } = data.source;
    if (!fields.name?.trim()) throw new Error("Source name is required");
    const row = { ...fields, name: fields.name.trim() };
    const { error } = id
      ? await db.from("content_sources").update(row).eq("id", id)
      : await db.from("content_sources").insert(row);
    return { ok: !error, error: error?.message ?? null };
  });

export const setSourceActive = createServerFn({ method: "POST" })
  .inputValidator((data: Gate & { id: string; active: boolean }) => data)
  .handler(async ({ data }) => {
    await requireDesk(data.deskToken);
    const { admin } = await import("@/lib/ingest.server");
    const db = await admin();
    const { error } = await db
      .from("content_sources")
      .update({ active: data.active, status: data.active ? "healthy" : "inactive" })
      .eq("id", data.id);
    return { ok: !error, error: error?.message ?? null };
  });

export const deleteSource = createServerFn({ method: "POST" })
  .inputValidator((data: Gate & { id: string }) => data)
  .handler(async ({ data }) => {
    await requireDesk(data.deskToken);
    const { admin } = await import("@/lib/ingest.server");
    const db = await admin();
    const { error } = await db.from("content_sources").delete().eq("id", data.id);
    return { ok: !error, error: error?.message ?? null };
  });

/** Today's editorial counters shown at the top of the Command Center. */
export const commandCounters = createServerFn({ method: "GET" })
  .inputValidator((data: Gate) => data)
  .handler(async ({ data }) => {
    await requireDesk(data.deskToken);
    const { admin } = await import("@/lib/ingest.server");
    const db = await admin();
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const count = async (build: (q: any) => any) => {
      const { count: n } = await build(
        db.from("raw_ingestion_items").select("id", { count: "exact", head: true }),
      );
      return n ?? 0;
    };
    const [collected, duplicates, recommended, needsReview, approved, published, sourceErrors] =
      await Promise.all([
        count((q) => q.gte("discovered_datetime", since)),
        count((q) => q.gte("discovered_datetime", since).in("dedupe_status", ["possible_duplicate", "duplicate"])),
        count((q) => q.eq("processing_status", "recommended")),
        count((q) => q.in("processing_status", ["new", "needs_review"])),
        count((q) => q.eq("processing_status", "approved")),
        count((q) => q.eq("processing_status", "published").gte("updated_at", since)),
        (async () => {
          const { count: n } = await db
            .from("content_sources")
            .select("id", { count: "exact", head: true })
            .eq("status", "error");
          return n ?? 0;
        })(),
      ]);
    return { collected, duplicates, recommended, needsReview, approved, published, sourceErrors };
  });

export const listReviewQueue = createServerFn({ method: "GET" })
  .inputValidator((data: Gate & { status?: string; city?: string }) => data)
  .handler(async ({ data }) => {
    await requireDesk(data.deskToken);
    const { admin } = await import("@/lib/ingest.server");
    const db = await admin();
    let q = db
      .from("raw_ingestion_items")
      .select("*")
      .order("priority_score", { ascending: false })
      .order("discovered_datetime", { ascending: false })
      .limit(60);
    if (data.status && data.status !== "all") q = q.eq("processing_status", data.status);
    else q = q.in("processing_status", ["new", "needs_review", "recommended", "approved"]);
    if (data.city && data.city !== "all") q = q.eq("city", data.city);
    const { data: rows, error } = await q;
    return { rows: rows ?? [], error: error?.message ?? null };
  });

/** Editor decision. Rejections capture a reason so scoring can learn later. */
export const reviewItem = createServerFn({ method: "POST" })
  .inputValidator(
    (data: Gate & {
      ids: string[];
      action: "approve" | "reject" | "publish" | "duplicate" | "recommend";
      reason?: string;
      edits?: {
        digest_headline?: string;
        what_happened?: string;
        why_it_matters?: string;
        what_to_do?: string;
        city?: string;
        topic?: string;
      };
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireDesk(data.deskToken);
    const { admin } = await import("@/lib/ingest.server");
    const db = await admin();
    if (!data.ids.length) return { ok: true, published: 0, error: null };

    const statusFor = {
      approve: "approved",
      reject: "rejected",
      publish: "published",
      duplicate: "duplicate",
      recommend: "recommended",
    } as const;

    const patch: Record<string, unknown> = {
      processing_status: statusFor[data.action],
      ...(data.edits ?? {}),
    };
    if (data.action === "duplicate") patch["dedupe_status"] = "duplicate";

    const { error } = await db.from("raw_ingestion_items").update(patch).in("id", data.ids);
    if (error) return { ok: false, published: 0, error: error.message };

    await db.from("editorial_reviews").insert(
      data.ids.map((id) => ({
        raw_item_id: id,
        action: data.action,
        rejection_reason: data.reason ?? null,
      })),
    );

    let published = 0;
    if (data.action === "publish") {
      const { publishRawItems } = await import("@/lib/ingest-publish.server");
      published = await publishRawItems(data.ids);
    }
    return { ok: true, published, error: null };
  });

/** Editor dislike: permanently delete queue items and any published copy. */
export const purgeQueueItems = createServerFn({ method: "POST" })
  .inputValidator((data: Gate & { ids: string[] }) => data)
  .handler(async ({ data }) => {
    await requireDesk(data.deskToken);
    const { purgeRawItems } = await import("@/lib/purge.server");
    return purgeRawItems((data.ids ?? []).slice(0, 200).map(String));
  });

/** Mass approve & publish everything currently awaiting a decision. */
export const massApproveQueue = createServerFn({ method: "POST" })
  .inputValidator((data: Gate & { city?: string; limit?: number }) => data)
  .handler(async ({ data }) => {
    await requireDesk(data.deskToken);
    const { admin } = await import("@/lib/ingest.server");
    const db = await admin();
    let q = db
      .from("raw_ingestion_items")
      .select("id")
      .in("processing_status", ["new", "needs_review", "recommended", "approved"])
      .neq("dedupe_status", "duplicate")
      .order("priority_score", { ascending: false })
      .limit(Math.min(Math.max(Number(data.limit) || 200, 1), 500));
    if (data.city && data.city !== "all") q = q.eq("city", data.city);
    const { data: rows, error } = await q;
    if (error) return { ok: false, published: 0, approved: 0, error: error.message };
    const ids = ((rows ?? []) as Array<{ id: string }>).map((row) => row.id);
    if (!ids.length) return { ok: true, published: 0, approved: 0, error: null };

    const { error: updateError } = await db
      .from("raw_ingestion_items")
      .update({ processing_status: "published" })
      .in("id", ids);
    if (updateError) return { ok: false, published: 0, approved: 0, error: updateError.message };
    await db.from("editorial_reviews").insert(
      ids.map((id) => ({ raw_item_id: id, action: "publish" })),
    );
    const { publishRawItems } = await import("@/lib/ingest-publish.server");
    const published = await publishRawItems(ids);
    return { ok: true, published, approved: ids.length, error: null };
  });

/** Manual "collect now" from the Command Center. */

export const runIngestNow = createServerFn({ method: "POST" })
  .inputValidator((data: Gate & { sourceId?: string }) => data)
  .handler(async ({ data }) => {
    await requireDesk(data.deskToken);
    const { runIngestion } = await import("@/lib/ingest.server");
    const summary = await runIngestion({
      budgetMs: 40_000,
      ...(data.sourceId ? { sourceId: data.sourceId } : {}),
    });
    return summary;
  });
