/**
 * Per-source ingest logging.
 *
 * Every automated pull writes one row per source into `ingest_runs`, so a
 * single failing publisher is visible instead of silently killing a whole
 * category. Server-only: never import from a route component.
 */

export type IngestRunRow = {
  run_id: string;
  mode: string;
  source: string;
  category?: string | null;
  status: "ok" | "failed" | "skipped";
  items_found?: number;
  items_inserted?: number;
  error?: string | null;
  trigger?: string;
  started_at?: string;
  finished_at?: string;
};

/** Writes run rows. Never throws: logging must not break an ingest. */
export async function logIngestRuns(rows: IngestRunRow[]): Promise<void> {
  if (!rows.length) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("ingest_runs").insert(
      rows.map((r) => ({
        run_id: r.run_id,
        mode: r.mode,
        source: r.source.slice(0, 200),
        category: r.category ?? null,
        status: r.status,
        items_found: r.items_found ?? 0,
        items_inserted: r.items_inserted ?? 0,
        error: r.error ? String(r.error).slice(0, 1000) : null,
        trigger: r.trigger ?? "cron",
        started_at: r.started_at ?? now,
        finished_at: r.finished_at ?? now,
      })) as never,
    );
    if (error) console.error("ingest_runs insert failed", error.message);
  } catch (err) {
    console.error("ingest_runs insert threw", err);
  }
}
