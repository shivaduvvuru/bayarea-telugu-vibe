import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Images, RefreshCw, Clock, UserRound, Users, Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { glamourDashboard, type GlamourDashboard } from "@/lib/glamour-dashboard.functions";

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
          <Button asChild variant="ghost" size="sm">
            <Link to="/desk">Review desk</Link>
          </Button>
        </div>
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
