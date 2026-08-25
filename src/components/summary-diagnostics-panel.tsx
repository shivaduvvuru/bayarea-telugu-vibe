import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSummaryDiagnostics } from "@/lib/ingest-health.functions";

/**
 * Diagnostics for the batched Gemini summaries: how many model calls each
 * collection made, how many headlines were skipped because they were already
 * stored, the average batch size, and any regression warning raised against the
 * trailing average of previous runs.
 */
export function SummaryDiagnosticsPanel() {
  const load = useServerFn(getSummaryDiagnostics);
  const query = useQuery({
    queryKey: ["summary-diagnostics"],
    queryFn: () => load({}),
    staleTime: 60_000,
  });

  const data = query.data;
  const latest = data?.latest ?? null;

  return (
    <section className="mt-8">
      <h2 className="border-b-2 border-primary pb-1.5 text-sm font-bold uppercase tracking-wide text-ink">
        Summary batching
        <span className="ml-2 font-normal normal-case text-muted-foreground">
          Gemini calls per collection run
        </span>
      </h2>

      {query.isLoading && <p className="mt-3 text-sm text-muted-foreground">Reading metrics…</p>}
      {query.isError && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {(query.error as Error).message}
        </p>
      )}
      {!query.isLoading && !latest && (
        <p className="mt-3 text-sm text-muted-foreground">
          No summary runs recorded yet — metrics appear after the next collection.
        </p>
      )}

      {latest && data && (
        <>
          {data.warnings.length > 0 && (
            <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-destructive">
                Regression warning
              </p>
              <ul className="mt-1 space-y-1 text-sm text-ink">
                {data.warnings.map((w) => (
                  <li key={w}>• {w}</li>
                ))}
              </ul>
            </div>
          )}

          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Gemini calls" value={latest.calls} hint={`${latest.batches} batch(es)`} />
            <Stat
              label="Avg batch size"
              value={Number(latest.avg_batch_size).toFixed(1)}
              hint={`${latest.items_summarized} headline(s)`}
            />
            <Stat
              label="Already-stored skips"
              value={latest.items_skipped}
              hint="no call spent"
            />
            <Stat
              label="Truncation rate"
              value={`${(Number(latest.truncation_rate) * 100).toFixed(1)}%`}
              hint={`${latest.missing_entries} missing entr(ies)`}
              bad={Number(latest.truncation_rate) > 0.1}
            />
            <Stat
              label="Per-item failovers"
              value={latest.fallback_calls}
              hint={`${latest.malformed_batches} malformed batch(es)`}
              bad={latest.malformed_batches > 0}
            />
            <Stat
              label="Retries / throttles"
              value={`${latest.retries} / ${latest.throttled}`}
              hint={`${latest.unresolved} unresolved`}
              bad={latest.unresolved > 0}
            />
          </dl>

          <p className="mt-2 text-xs text-muted-foreground">
            Baseline over {data.baseline.runs} earlier run(s):{" "}
            {data.baseline.callsPerItem.toFixed(2)} calls per headline,{" "}
            {(data.baseline.truncationRate * 100).toFixed(1)}% truncation, avg batch{" "}
            {data.baseline.avgBatchSize.toFixed(1)}.
          </p>

          <ul className="mt-3 divide-y divide-border text-sm">
            {data.runs.slice(0, 8).map((r) => (
              <li
                key={r.created_at}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-1.5"
              >
                <span className="truncate text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()} · {r.trigger}
                </span>
                <span className="shrink-0 text-xs font-semibold text-ink">
                  {r.calls} call(s) · {r.items_summarized} item(s) · avg{" "}
                  {Number(r.avg_batch_size).toFixed(1)}
                  {r.warnings.length > 0 && (
                    <span className="ml-2 text-destructive">warned</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
  bad,
}: {
  label: string;
  value: string | number;
  hint?: string;
  bad?: boolean;
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 text-lg font-bold ${bad ? "text-destructive" : "text-ink"}`}>
        {value}
      </dd>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
