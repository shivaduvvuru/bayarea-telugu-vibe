/**
 * Persistence and regression watch for the batched summary metrics.
 *
 * Every collection run records one row in `summary_runs`. The row is compared
 * against the trailing average of the previous runs, so a change that quietly
 * makes the batching worse — more calls for the same number of headlines, or
 * more entries the model fails to return — shows up as a warning on
 * /admin/health and, when it is bad enough, as a Pushover alert.
 */

import {
  averageBatchSize,
  truncationRate,
  type BatchMetrics,
} from "./summary-batch";

export type SummaryRunRow = {
  created_at: string;
  trigger: string;
  calls: number;
  batches: number;
  fallback_calls: number;
  items_summarized: number;
  items_skipped: number;
  malformed_batches: number;
  missing_entries: number;
  unknown_entries: number;
  unresolved: number;
  retries: number;
  throttled: number;
  avg_batch_size: number;
  truncation_rate: number;
  warnings: string[];
};

/** Runs compared against, and the slack allowed before a warning fires. */
export const BASELINE_RUNS = 10;
/** Calls per summarized item may exceed the trailing average by this factor. */
export const CALLS_REGRESSION_FACTOR = 1.5;
/** Truncation may exceed the trailing average by this many percentage points. */
export const TRUNCATION_REGRESSION_POINTS = 0.05;
/** A single run above this truncation rate is always flagged. */
export const TRUNCATION_FLOOR = 0.1;

export type Baseline = {
  runs: number;
  callsPerItem: number;
  truncationRate: number;
  avgBatchSize: number;
};

export function baselineOf(rows: readonly SummaryRunRow[]): Baseline {
  const usable = rows.filter((r) => r.items_summarized > 0);
  if (!usable.length) return { runs: 0, callsPerItem: 0, truncationRate: 0, avgBatchSize: 0 };
  const mean = (pick: (r: SummaryRunRow) => number) =>
    usable.reduce((sum, r) => sum + pick(r), 0) / usable.length;
  return {
    runs: usable.length,
    callsPerItem: mean((r) => r.calls / Math.max(1, r.items_summarized)),
    truncationRate: mean((r) => Number(r.truncation_rate) || 0),
    avgBatchSize: mean((r) => Number(r.avg_batch_size) || 0),
  };
}

/**
 * Warnings for one run against its baseline. Pure, so the thresholds can be
 * exercised without a database.
 */
export function regressionWarnings(current: SummaryRunRow, baseline: Baseline): string[] {
  const warnings: string[] = [];
  if (current.items_summarized > 0) {
    const rate = Number(current.truncation_rate) || 0;
    if (rate > TRUNCATION_FLOOR) {
      warnings.push(
        `Truncation rate ${(rate * 100).toFixed(1)}% — the model failed to return ${current.missing_entries} of ${current.items_summarized} headlines. Consider a smaller batch cap.`,
      );
    } else if (
      baseline.runs >= 3 &&
      rate > baseline.truncationRate + TRUNCATION_REGRESSION_POINTS
    ) {
      warnings.push(
        `Truncation rate rose to ${(rate * 100).toFixed(1)}% from a ${(baseline.truncationRate * 100).toFixed(1)}% average.`,
      );
    }

    const callsPerItem = current.calls / current.items_summarized;
    if (
      baseline.runs >= 3 &&
      baseline.callsPerItem > 0 &&
      callsPerItem > baseline.callsPerItem * CALLS_REGRESSION_FACTOR
    ) {
      warnings.push(
        `Summary calls per headline rose to ${callsPerItem.toFixed(2)} from a ${baseline.callsPerItem.toFixed(2)} average — batching may have stopped working.`,
      );
    }
  }
  if (current.malformed_batches > 0) {
    warnings.push(
      `${current.malformed_batches} batch reply(ies) were not valid id-keyed JSON and were re-summarized one item at a time.`,
    );
  }
  if (current.unresolved > 0) {
    warnings.push(
      `${current.unresolved} headline(s) kept the placeholder summary because every model call failed.`,
    );
  }
  return warnings;
}

/** Builds the row for a finished run. */
export function metricsRow(
  metrics: BatchMetrics,
  itemsSkipped: number,
  trigger: string,
): SummaryRunRow {
  return {
    created_at: new Date().toISOString(),
    trigger,
    calls: metrics.calls,
    batches: metrics.batches,
    fallback_calls: metrics.fallbackCalls,
    items_summarized: metrics.itemsSummarized,
    items_skipped: itemsSkipped,
    malformed_batches: metrics.malformedBatches,
    missing_entries: metrics.missingEntries,
    unknown_entries: metrics.unknownEntries,
    unresolved: metrics.unresolved,
    retries: metrics.retry.retries,
    throttled: metrics.retry.throttled,
    avg_batch_size: averageBatchSize(metrics),
    truncation_rate: truncationRate(metrics),
    warnings: [],
  };
}

/**
 * Records the run, compares it against the trailing baseline and alerts when a
 * regression is found. Never throws: monitoring must not break a collection.
 */
export async function recordSummaryRun(
  metrics: BatchMetrics,
  itemsSkipped: number,
  trigger = "cron",
): Promise<{ row: SummaryRunRow; warnings: string[] }> {
  const row = metricsRow(metrics, itemsSkipped, trigger);
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("summary_runs")
      .select(
        "created_at,trigger,calls,batches,fallback_calls,items_summarized,items_skipped,malformed_batches,missing_entries,unknown_entries,unresolved,retries,throttled,avg_batch_size,truncation_rate,warnings",
      )
      .order("created_at", { ascending: false })
      .limit(BASELINE_RUNS);
    const baseline = baselineOf((data ?? []) as SummaryRunRow[]);
    row.warnings = regressionWarnings(row, baseline);

    await supabaseAdmin.from("summary_runs").insert(row as never);

    if (row.warnings.length) {
      console.warn(`[summarize] regression: ${row.warnings.join(" | ")}`);
      const { sendPushover } = await import("./pushover.server");
      await sendPushover({
        title: "TBA summary batching regression",
        message: row.warnings.join("\n"),
        priority: 1,
      });
    }
  } catch (error) {
    console.error("summary metrics write failed", error);
  }
  return { row, warnings: row.warnings };
}

/** Recent runs plus the baseline, for the admin diagnostic panel. */
export async function summaryDiagnostics(): Promise<{
  runs: SummaryRunRow[];
  baseline: Baseline;
  latest: SummaryRunRow | null;
  warnings: string[];
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("summary_runs")
    .select(
      "created_at,trigger,calls,batches,fallback_calls,items_summarized,items_skipped,malformed_batches,missing_entries,unknown_entries,unresolved,retries,throttled,avg_batch_size,truncation_rate,warnings",
    )
    .order("created_at", { ascending: false })
    .limit(20);
  const runs = (data ?? []) as SummaryRunRow[];
  const [latest, ...previous] = runs;
  return {
    runs,
    baseline: baselineOf(previous),
    latest: latest ?? null,
    warnings: latest?.warnings ?? [],
  };
}
