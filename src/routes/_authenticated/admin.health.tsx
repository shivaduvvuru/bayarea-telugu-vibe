import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  getIngestHealth,
  runIngestSource,
  runAuditNow,
  sendTestAlert,
} from "@/lib/ingest-health.functions";
import { syncNewsNow } from "@/lib/sync-news.functions";

import { Button } from "@/components/ui/button";
import { SummaryDiagnosticsPanel } from "@/components/summary-diagnostics-panel";

export const Route = createFileRoute("/_authenticated/admin/health")({
  head: () => ({
    meta: [
      { title: "Ingest health — Times Bay Area" },
      {
        name: "description",
        content:
          "Per-category and per-source ingest health for Times Bay Area, with manual runs and alert tests.",
      },
      { property: "og:title", content: "Ingest health — Times Bay Area" },
      { property: "og:description", content: "Newsroom ingest monitoring console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IngestHealthPage,
});

function ago(iso: string | null) {
  if (!iso) return "never";
  const hours = (Date.now() - Date.parse(iso)) / 3_600_000;
  if (Number.isNaN(hours)) return "unknown";
  if (hours < 1) return "just now";
  if (hours < 48) return `${Math.floor(hours)}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function IngestHealthPage() {
  const load = useServerFn(getIngestHealth);
  const runSource = useServerFn(runIngestSource);
  const audit = useServerFn(runAuditNow);
  const test = useServerFn(sendTestAlert);
  const syncNews = useServerFn(syncNewsNow);
  const [note, setNote] = useState<string | null>(null);

  const sync = useMutation({
    mutationFn: () => syncNews({ data: { mode: "all" } }),
    onSuccess: (r: Record<string, unknown>) => {
      setNote(
        r["ok"]
          ? `News sync finished: ${r["published"] ?? 0} published, ${r["collected"] ?? 0} collected.`
          : `News sync failed: ${String(r["error"] ?? r["status"] ?? "unknown")}`,
      );
      query.refetch();
    },
    onError: (e) => setNote((e as Error).message),
  });


  const query = useQuery({
    queryKey: ["ingest-health"],
    queryFn: () => load({}),
    staleTime: 60_000,
  });

  const run = useMutation({
    mutationFn: (source?: string) => runSource({ data: source ? { source } : {} }),
    onSuccess: (r) => {
      setNote(`Run finished: ${r.inserted} new item(s), ${r.failed} source(s) failed.`);
      query.refetch();
    },
    onError: (e) => setNote((e as Error).message),
  });
  const alert = useMutation({
    mutationFn: () => test({}),
    onSuccess: (r) =>
      setNote(r.ok ? "Test alert sent to Pushover." : `Pushover failed (HTTP ${r.status}).`),
    onError: (e) => setNote((e as Error).message),
  });
  const auditRun = useMutation({
    mutationFn: () => audit({}),
    onSuccess: (r) => {
      setNote(
        r.issues.length
          ? `${r.issues.length} issue(s) flagged${r.notified ? " and alerted" : ""}.`
          : "Audit clean — no alert sent.",
      );
      query.refetch();
    },
    onError: (e) => setNote((e as Error).message),
  });

  const report = query.data;
  const busy = run.isPending || alert.isPending || auditRun.isPending || sync.isPending;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <h1 className="font-serif text-3xl">Ingest health</h1>
          <p className="text-sm text-muted-foreground">
            Newest story per section, per-source outcomes and whether each scheduled job fired.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <Button variant="outline" asChild>
            <Link to="/admin">Newsroom</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/duplicates">Duplicate audit</Link>
          </Button>
          <Button variant="outline" onClick={() => alert.mutate()} disabled={busy}>
            Send test alert
          </Button>
          <Button variant="outline" onClick={() => auditRun.mutate()} disabled={busy}>
            Run audit
          </Button>
          <Button variant="outline" onClick={() => sync.mutate()} disabled={busy}>
            {sync.isPending ? "Syncing news…" : "Sync News Now"}
          </Button>
          <Button onClick={() => run.mutate(undefined)} disabled={busy}>
            {run.isPending ? "Running…" : "Run India ingest"}
          </Button>

        </div>
      </header>

      {note && <p className="mt-4 text-sm font-semibold text-ink">{note}</p>}
      {query.isError && (
        <p role="alert" className="mt-6 text-sm text-destructive">
          {(query.error as Error).message}
        </p>
      )}
      {query.isLoading && <p className="mt-10 text-sm text-muted-foreground">Reading health…</p>}

      {report && (
        <>
          {report.issues.length > 0 && (
            <section className="mt-6 rounded-md border border-destructive/40 bg-destructive/5 p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-destructive">
                {report.issues.length} issue{report.issues.length === 1 ? "" : "s"}
              </h2>
              <ul className="mt-2 space-y-1 text-sm text-ink">
                {report.issues.map((i) => (
                  <li key={i.text}>• {i.text}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-8">
            <h2 className="border-b-2 border-primary pb-1.5 text-sm font-bold uppercase tracking-wide text-ink">
              Sections
            </h2>
            <ul className="mt-2 divide-y divide-border">
              {report.categories.map((c) => (
                <li
                  key={c.category}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2 text-sm"
                >
                  <span className="truncate font-semibold text-ink">{c.category}</span>
                  <span
                    className={`shrink-0 rounded-sm px-2 py-0.5 text-xs font-bold ${
                      c.stale ? "bg-destructive text-destructive-foreground" : "bg-emerald-700 text-white"
                    }`}
                  >
                    {ago(c.newest)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="border-b-2 border-primary pb-1.5 text-sm font-bold uppercase tracking-wide text-ink">
              Scheduled jobs
            </h2>
            <ul className="mt-2 divide-y divide-border">
              {report.jobs.map((j) => (
                <li
                  key={j.mode}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2 text-sm"
                >
                  <span className="truncate font-semibold text-ink">{j.mode}</span>
                  <span
                    className={`shrink-0 text-xs font-bold ${
                      j.firedInLast24h ? "text-emerald-700" : "text-destructive"
                    }`}
                  >
                    last run {ago(j.lastRun)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="border-b-2 border-primary pb-1.5 text-sm font-bold uppercase tracking-wide text-ink">
              Sources
              <span className="ml-2 font-normal normal-case text-muted-foreground">
                weakest first, 7-day totals
              </span>
            </h2>
            <ul className="mt-2 divide-y divide-border">
              {report.sources.map((s) => (
                <li
                  key={s.source}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">
                      {s.source}
                      {s.flagged && <span className="ml-2 text-xs text-destructive">flagged</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.items7d} items / 7d · {s.items72h} / 72h · last ok {ago(s.lastSuccess)}
                    </p>
                    {s.lastError && <p className="truncate text-xs text-destructive">{s.lastError}</p>}
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0" disabled={busy} onClick={() => run.mutate(s.source)}>
                    Run now
                  </Button>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="border-b-2 border-primary pb-1.5 text-sm font-bold uppercase tracking-wide text-ink">
              Latest feed fetches
              <span className="ml-2 font-normal normal-case text-muted-foreground">
                zero-item feeds first; fetched → kept
              </span>
            </h2>
            <ul className="mt-2 divide-y divide-border">
              {report.feeds.map((f) => (
                <li key={f.source} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">
                      {f.source}
                      {f.zeroItems && <span className="ml-2 text-xs text-destructive">0 items</span>}
                      {f.usedFallback && <span className="ml-2 text-xs text-primary">fallback</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {f.fetched} fetched → {f.kept} kept · {f.withImage} with image · last {ago(f.lastFetchAt)}
                    </p>
                    {f.error && <p className="truncate text-xs text-destructive">{f.error}</p>}
                  </div>
                  <span className={`shrink-0 text-xs font-bold ${f.zeroItems || f.error ? "text-destructive" : "text-emerald-700"}`}>
                    {f.runMode ?? "unknown"}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <SummaryDiagnosticsPanel />

          <p className="mt-8 text-xs text-muted-foreground">
            Checked {new Date(report.checkedAt).toLocaleString()}
          </p>
        </>
      )}
    </div>
  );
}
