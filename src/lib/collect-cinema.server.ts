/**
 * Cinema/OTT + micro-drama ingest, running as its own job.
 *
 * One run per desk: collect → drop already-known stories → queue → publish this
 * desk's approved rows. Every run writes a `collect_runs` row (desk, funnel,
 * error), and a run refuses to start while another cinema run is still open, so
 * a slow Google News sweep can never produce two overlapping runs fighting over
 * the same dedupe keys.
 */

export type DeskName = "cinema" | "micro-drama";

export type DeskRunResult = {
  desk: DeskName;
  fetched: number;
  alreadyKnown: number;
  queued: number;
  autoApproved: number;
  held: number;
  published: number;
  deferredToNextRun: number;
  funnel: unknown;
  feedCaps: unknown;
  classification: unknown;
  imageFallback: unknown;
  notes: string[];
  elapsedMs: number;
};

/** A cinema run is considered in progress while an unfinished row is < 10 min old. */
export async function cinemaRunInProgress(): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data } = await supabaseAdmin
    .from("collect_runs")
    .select("id")
    .eq("mode", "cinema-job")
    .is("finished_at", null)
    .gt("started_at", since)
    .limit(1);
  return (data ?? []).length > 0;
}

/** Opens the run row; returns its id so the hook can close it. */
export async function openCinemaRun(trigger: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("collect_runs")
    .insert({
      mode: "cinema-job",
      desk: "cinema+micro-drama",
      trigger,
      collected: 0,
      published: 0,
      held: 0,
      duplicates_hidden: 0,
      funnel: {},
      ok: true,
      finished_at: null,
    } as never)
    .select("id")
    .maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}

export async function closeCinemaRun(
  id: string | null,
  patch: { collected: number; published: number; held: number; funnel: unknown; ok: boolean; error?: string | null },
): Promise<void> {
  if (!id) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("collect_runs")
    .update({
      collected: patch.collected,
      published: patch.published,
      held: patch.held,
      funnel: patch.funnel as never,
      ok: patch.ok,
      error: patch.error ?? null,
      finished_at: new Date().toISOString(),
    } as never)
    .eq("id", id);
}

/** Collects and publishes one desk. Never sweeps pictures, WP or duplicates. */
export async function runDeskIngest(
  desk: DeskName,
  opts: { deadlineMs: number; publishCutoffMs: number },
): Promise<DeskRunResult> {
  const startedAt = Date.now();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { collectDesk, storyIdentityKeys, lastDiag } = await import("@/lib/collect-news.server");
  const { loadKnownKeys, isKnownStory, rememberKeys } = await import("@/lib/known-keys.server");
  const { canAutoPublish } = await import("@/lib/auto-publish");
  const { deskRowToIngest } = await import("@/lib/desk-publish.server");
  const { ingest } = await import("@/lib/cms.server");
  const { errorMessage } = await import("@/lib/error-message");

  const collectedRaw = await collectDesk(desk, process.env["LOVABLE_API_KEY"], {
    deadlineMs: opts.deadlineMs,
  });
  const known = await loadKnownKeys(supabaseAdmin as never);
  const fresh = collectedRaw.filter((r) => !isKnownStory(known, r));

  const marked = fresh.map((r) => ({
    ...r,
    status: canAutoPublish(r.kind, r.title, r.summary) ? "approved" : "pending",
  }));
  if (marked.length) {
    const { error } = await supabaseAdmin
      .from("digest_queue")
      .upsert(marked as never, { onConflict: "dedupe_key", ignoreDuplicates: true });
    if (error) throw error;
    rememberKeys(marked.flatMap((r) => [`d:${r.dedupe_key}`, ...storyIdentityKeys(r.title, r.source_url)]));
  }

  const approvedIds = marked.filter((r) => r.status === "approved").map((r) => r.item_id);
  const { data: queued } = await supabaseAdmin
    .from("digest_queue")
    .select("*")
    .eq("status", "approved")
    .neq("upload_status", "sent")
    .contains("payload", { desk })
    .limit(300);
  const batch = (queued ?? []) as unknown as Record<string, unknown>[];
  let publishedCount = 0;
  let deferred = 0;
  for (let i = 0; i < batch.length; i += 25) {
    if (Date.now() - startedAt > opts.publishCutoffMs) {
      deferred = batch.length - i;
      break;
    }
    const chunk = batch.slice(i, i + 25);
    const chunkIds = chunk.map((r) => String(r["item_id"]));
    try {
      await ingest(chunk.map(deskRowToIngest));
      await supabaseAdmin
        .from("digest_queue")
        .update({ upload_status: "sent", uploaded_at: new Date().toISOString(), error: null })
        .in("item_id", chunkIds);
      publishedCount += chunk.length;
    } catch (e) {
      const message = errorMessage(e);
      console.error(`${desk} publish chunk failed`, message);
      await supabaseAdmin
        .from("digest_queue")
        .update({ upload_status: "failed", error: message })
        .in("item_id", chunkIds);
    }
  }

  return {
    desk,
    fetched: collectedRaw.length,
    alreadyKnown: collectedRaw.length - fresh.length,
    queued: marked.length,
    autoApproved: approvedIds.length,
    held: marked.length - approvedIds.length,
    published: publishedCount,
    deferredToNextRun: deferred,
    funnel: lastDiag.deskFunnel,
    feedCaps: lastDiag.feedCaps,
    classification: lastDiag.classification,
    imageFallback: lastDiag.imageFallback,
    notes: [...lastDiag.notes],
    elapsedMs: Date.now() - startedAt,
  };
}
