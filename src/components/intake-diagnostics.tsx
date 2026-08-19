import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { latestIntakeFunnel, type IntakeFunnel } from "@/lib/collect-status.functions";

const REASON_LABEL: Record<string, string> = {
  no_primary_woman: "no single woman in frame",
  minor_or_age_uncertain: "age uncertain",
  image_corrupt: "image would not load",
  explicit: "explicit content",
};

/**
 * Live ingestion status for the editorial desk: what the last picture pull
 * discovered, where photos were dropped, and a manual fetch trigger. Reads the
 * staff-only run log through a server function.
 */
export function IntakeDiagnostics({
  onFetch,
  fetching,
}: {
  onFetch: () => Promise<void> | void;
  fetching: boolean;
}) {
  const read = useServerFn(latestIntakeFunnel);
  const [funnel, setFunnel] = useState<IntakeFunnel | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = (await read()) as IntakeFunnel | null;
      setFunnel(data);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read intake status");
    }
  }, [read]);

  useEffect(() => {
    void load();
  }, [load]);

  // Refresh the numbers once a manual fetch finishes.
  useEffect(() => {
    if (!fetching) void load();
  }, [fetching, load]);

  const stages: { label: string; value: number }[] = funnel
    ? [
        { label: "Discovered", value: funnel.discovered },
        { label: "Usable photos", value: funnel.candidates },
        { label: "Blocked by safety screen", value: funnel.safetyBlocked },
        { label: "Duplicates removed", value: funnel.duplicatesRemoved },
        { label: "Reached desk", value: funnel.toDesk },
      ]
    : [];

  return (
    <section className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Ingestion status
          </p>
          <p className="text-xs text-muted-foreground">
            {funnel
              ? `Last picture pull ${new Date(funnel.finishedAt).toLocaleString()} · ${funnel.ok ? "completed" : "failed"}`
              : "No picture pull logged yet."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => void onFetch()} disabled={fetching}>
            <Download className={fetching ? "animate-pulse" : ""} />
            {fetching ? "Fetching…" : "Fetch latest 50 pictures"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void load()} disabled={fetching}>
            <RefreshCw className="size-3" />
          </Button>
        </div>
      </div>

      {funnel && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {stages.map((s) => (
            <div key={s.label} className="rounded-md border border-border bg-background px-2 py-1.5">
              <span className="block text-base font-bold text-foreground">{s.value}</span>
              <span className="block text-[11px] leading-tight text-muted-foreground">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {funnel && Object.keys(funnel.reasons).length > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Rejections:{" "}
          {Object.entries(funnel.reasons)
            .map(([k, v]) => `${REASON_LABEL[k] ?? k} (${v})`)
            .join(" · ")}
        </p>
      )}

      {funnel && funnel.topSources.length > 0 && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Sources:{" "}
          {funnel.topSources.map((s) => `${s.name} ${s.candidates}/${s.discovered}`).join(" · ")}
        </p>
      )}

      {(funnel?.error || error) && (
        <p className="mt-2 text-xs text-destructive">{funnel?.error || error}</p>
      )}
    </section>
  );
}
