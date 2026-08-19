import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Images, RefreshCw, Clock, UserRound, Users, Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  glamourDashboard,
  ingestionFunnel,
  type GlamourDashboard,
  type IngestionRun,
} from "@/lib/glamour-dashboard.functions";

export const Route = createFileRoute("/glamour-dashboard")({
  head: () => ({
    meta: [
      { title: "Glamour folder dashboard — Bay Area Telugu Times" },
      {
        name: "description",
        content:
          "Every picture in the Glamour folder with its solo-woman status, likes, archive state and the next scheduled collection run.",
      },
      { property: "og:title", content: "Glamour folder dashboard — Bay Area Telugu Times" },
      {
        property: "og:description",
        content: "Live and archived Glamour pictures, solo status and collector schedule.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GlamourDashboardPage,
});

type Filter = "all" | "published" | "archived" | "pending" | "solo" | "group";

function when(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function countdown(iso: string | null) {
  if (!iso) return "—";
  const secs = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  if (secs <= 0) return "due now";
  if (secs < 60) return `in ${secs}s`;
  return `in ${Math.round(secs / 60)} min`;
}

function GlamourDashboardPage() {
  const fetchDashboard = useServerFn(glamourDashboard);
  const [filter, setFilter] = useState<Filter>("all");
  const fetchFunnel = useServerFn(ingestionFunnel);
  const { data: funnel } = useQuery({
    queryKey: ["ingestion-funnel"],
    refetchInterval: 60_000,
    queryFn: async () => await fetchFunnel({}),
  });

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["glamour-dashboard"],
    refetchInterval: 60_000,
    queryFn: async (): Promise<GlamourDashboard> => (await fetchDashboard({})) as GlamourDashboard,
  });

  const photos = useMemo(() => {
    const list = data?.photos ?? [];
    if (filter === "all") return list;
    if (filter === "solo") return list.filter((p) => p.solo);
    if (filter === "group") return list.filter((p) => !p.solo);
    return list.filter((p) => p.status === filter);
  }, [data, filter]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Images className="h-5 w-5 text-primary" aria-hidden />
            Glamour folder dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Every picture in the folder, its solo-woman status and the collector schedule.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} aria-hidden />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void runSweep()}
            disabled={sweeping}
          >
            <Users className={`mr-1.5 h-3.5 w-3.5 ${sweeping ? "animate-pulse" : ""}`} aria-hidden />
            {sweeping ? "Screening…" : "Move group photos to Cinema"}
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/desk">Review desk</Link>
          </Button>
        </div>
        {sweep ? (
          <p className="w-full text-xs text-muted-foreground">
            Last screen: {sweep.checked} checked · {sweep.moved} moved to Cinema/OTT ·{" "}
            {sweep.solo} confirmed solo · {sweep.unchecked} unjudged
          </p>
        ) : null}

      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Live in folder</p>
          <p className="text-2xl font-bold">
            {data?.live ?? "–"}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              / min {data?.minimum ?? 300}
            </span>
          </p>
        </Card>
        <Card className="p-3">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Archive className="h-3 w-3" aria-hidden /> Archived
          </p>
          <p className="text-2xl font-bold">{data?.archived ?? "–"}</p>
        </Card>
        <Card className="p-3">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <UserRound className="h-3 w-3" aria-hidden /> Solo woman
          </p>
          <p className="text-2xl font-bold">{data?.solo ?? "–"}</p>
        </Card>
        <Card className="p-3">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" aria-hidden /> Next run
          </p>
          <p className="text-lg font-bold">{countdown(data?.nextRunAt ?? null)}</p>
          <p className="text-[11px] text-muted-foreground">
            every {data?.cadenceMinutes ?? 1} min · last {when(data?.lastRunAt ?? null)}
          </p>
        </Card>
      </div>

      <IngestionFunnelPanel
        runs={funnel?.runs ?? []}
        rejects={funnel?.recentRejects ?? []}
      />

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="mt-5">
        <TabsList className="flex w-full flex-wrap">
          <TabsTrigger value="all">All ({data?.photos.length ?? 0})</TabsTrigger>
          <TabsTrigger value="published">Live ({data?.live ?? 0})</TabsTrigger>
          <TabsTrigger value="archived">Archived ({data?.archived ?? 0})</TabsTrigger>
          <TabsTrigger value="pending">In desk ({data?.pending ?? 0})</TabsTrigger>
          <TabsTrigger value="solo">Solo ({data?.solo ?? 0})</TabsTrigger>
          <TabsTrigger value="group">Group ({data?.nonSolo ?? 0})</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No pictures match this filter yet.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p) => (
            <li key={p.id} className="overflow-hidden rounded-lg border border-border">
              <div className="aspect-[4/5] bg-muted">
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.title}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="space-y-1.5 p-2">
                <p className="line-clamp-2 text-xs font-medium">{p.title}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={p.solo ? "default" : "secondary"} className="gap-1 text-[10px]">
                    {p.solo ? (
                      <>
                        <UserRound className="h-3 w-3" aria-hidden /> Solo
                      </>
                    ) : (
                      <>
                        <Users className="h-3 w-3" aria-hidden /> Group / unclear
                      </>
                    )}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {p.status === "published" ? "live" : p.status}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{p.likes} likes</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{when(p.published_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}


function pct(part: number, whole: number) {
  if (!whole) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

/**
 * Ingestion funnel: shows exactly how many photos each stage removes, so a
 * rule that is throttling review-desk intake is visible at a glance.
 */
function IngestionFunnelPanel({
  runs,
  rejects,
}: {
  runs: IngestionRun[];
  rejects: { reason: string; count: number }[];
}) {
  const latest = runs.find((r) => r.discovered > 0) ?? runs[0];
  const window = runs.slice(0, 10).filter((r) => r.discovered > 0);
  const totals = window.reduce(
    (acc, r) => ({
      discovered: acc.discovered + r.discovered,
      toDesk: acc.toDesk + r.toDesk,
      minutes: acc.minutes + 1,
    }),
    { discovered: 0, toDesk: 0, minutes: 0 },
  );
  if (!latest) return null;

  const stages: { label: string; value: number; lost?: number; lostLabel?: string }[] = [
    { label: "Discovered", value: latest.discovered },
    {
      label: "Has usable image",
      value: latest.discovered - latest.noImage - latest.imageUnusable,
      lost: latest.noImage + latest.imageUnusable,
      lostLabel: "download_failed / resolution_unusable",
    },
    {
      label: "Editorial (not hard news)",
      value: latest.candidates,
      lost: latest.hardNews,
      lostLabel: "hard_news",
    },
    {
      label: "Safety + solo-woman screen",
      value: latest.candidates - latest.safetyBlocked,
      lost: latest.safetyBlocked,
      lostLabel: "minor / explicit / no_primary_woman",
    },
    {
      label: "After duplicate removal",
      value: Math.max(latest.candidates - latest.safetyBlocked - latest.duplicatesRemoved, 0),
      lost: latest.duplicatesRemoved,
      lostLabel: "duplicate",
    },
    { label: "Reached Review Desk", value: latest.toDesk },
  ];

  const sources = Object.entries(latest.bySource)
    .sort((a, b) => b[1].discovered - a[1].discovered)
    .slice(0, 12);

  return (
    <Card className="mt-5 p-4">
      <h2 className="mb-1 text-sm font-bold uppercase tracking-wide">Ingestion funnel</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Last run {when(latest.at)} · {latest.mode}/{latest.trigger} ·{" "}
        {latest.unscreenedPassed} photo(s) passed unscreened (fail-open) ·{" "}
        {totals.minutes ? (totals.toDesk / totals.minutes).toFixed(1) : "0"} to desk per run ·
        acceptance {pct(totals.toDesk, totals.discovered)}
      </p>
      <ol className="space-y-1.5">
        {stages.map((stage) => (
          <li key={stage.label} className="flex items-center gap-2 text-sm">
            <span className="w-52 shrink-0 text-muted-foreground">{stage.label}</span>
            <span className="font-bold tabular-nums">{stage.value}</span>
            {stage.lost ? (
              <Badge variant="outline" className="text-[11px]">
                −{stage.lost} ({pct(stage.lost, latest.discovered)}) {stage.lostLabel}
              </Badge>
            ) : null}
          </li>
        ))}
      </ol>

      {rejects.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {rejects.map((r) => (
            <Badge key={r.reason} variant="secondary" className="text-[11px]">
              {r.reason}: {r.count}
            </Badge>
          ))}
        </div>
      ) : null}

      {sources.length ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 text-left font-medium">Source</th>
                <th className="py-1 text-right font-medium">Discovered</th>
                <th className="py-1 text-right font-medium">Candidates</th>
                <th className="py-1 text-right font-medium">Success</th>
              </tr>
            </thead>
            <tbody>
              {sources.map(([name, stat]) => (
                <tr key={name} className="border-t border-border/60">
                  <td className="py-1 pr-2">{name}</td>
                  <td className="py-1 text-right tabular-nums">{stat.discovered}</td>
                  <td className="py-1 text-right tabular-nums">{stat.candidates}</td>
                  <td className="py-1 text-right tabular-nums">
                    {pct(stat.candidates, stat.discovered)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Card>
  );
}
