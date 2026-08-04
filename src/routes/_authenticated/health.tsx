import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSourceHealth } from "@/lib/health.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/health")({
  head: () => ({
    meta: [
      { title: "Source health — Bay Area Telugu Times" },
      {
        name: "description",
        content:
          "Live status of every temple, politics and syndication feed powering Bay Area Telugu Times.",
      },
      { property: "og:title", content: "Source health — Bay Area Telugu Times" },
      { property: "og:description", content: "Ingestion pipeline monitoring console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HealthPage,
});

function ago(iso: string | null) {
  if (!iso) return "unknown";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "unknown";
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function HealthPage() {
  const run = useServerFn(getSourceHealth);
  const query = useQuery({
    queryKey: ["source-health"],
    queryFn: () => run({}),
    staleTime: 60_000,
  });

  const report = query.data;
  const groups = ["Syndication", "Temples", "Politics"] as const;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <h1 className="font-serif text-3xl">Source health</h1>
          <p className="text-sm text-muted-foreground">
            Live probe of every feed the site pulls from, plus snapshot and store freshness.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" asChild>
            <Link to="/admin">Newsroom</Link>
          </Button>
          <Button onClick={() => query.refetch()} disabled={query.isFetching}>
            {query.isFetching ? "Checking…" : "Re-check"}
          </Button>
        </div>
      </header>

      {query.isError && (
        <p role="alert" className="mt-6 text-sm text-destructive">
          {(query.error as Error).message}
        </p>
      )}
      {query.isLoading && (
        <p className="mt-10 text-sm text-muted-foreground">Probing every source…</p>
      )}

      {report && (
        <>
          <section className="mt-6 grid gap-3 sm:grid-cols-3">
            {groups.map((g) => {
              const list = report.probes.filter((p) => p.group === g);
              const ok = list.filter((p) => p.ok).length;
              const healthy = list.length === 0 || ok === list.length;
              return (
                <div key={g} className="rounded-md border border-border p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {g}
                  </p>
                  <p
                    className={`mt-1 text-2xl font-black ${healthy ? "text-ink" : "text-destructive"}`}
                  >
                    {ok}/{list.length}
                  </p>
                  <p className="text-xs text-muted-foreground">sources responding</p>
                </div>
              );
            })}
          </section>

          <section className="mt-8">
            <h2 className="border-b-2 border-primary pb-1.5 text-sm font-bold uppercase tracking-wide text-ink">
              Snapshots &amp; content store
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {report.snapshots.map((s) => {
                const stale =
                  !s.generatedAt ||
                  Date.now() - new Date(s.generatedAt).getTime() > 7 * 86_400_000;
                return (
                  <div key={s.id} className="rounded-md border border-border p-4 text-sm">
                    <p className="font-semibold text-ink">{s.label}</p>
                    <p className="text-muted-foreground">
                      {s.items} items · refreshed {ago(s.generatedAt)}
                    </p>
                    {stale && (
                      <p className="mt-1 text-xs font-semibold text-destructive">
                        Older than a week — re-run the snapshot script.
                      </p>
                    )}
                  </div>
                );
              })}
              <div className="rounded-md border border-border p-4 text-sm sm:col-span-2">
                <p className="font-semibold text-ink">Content store</p>
                {report.storeError ? (
                  <p className="text-destructive">{report.storeError}</p>
                ) : (
                  <p className="text-muted-foreground">
                    {report.store.map((s) => `${s.count} ${s.status}`).join(" · ")}
                  </p>
                )}
              </div>
            </div>
          </section>

          {groups.map((g) => {
            const list = report.probes.filter((p) => p.group === g);
            if (list.length === 0) return null;
            const failing = list.filter((p) => !p.ok);
            return (
              <section key={g} className="mt-8">
                <h2 className="border-b-2 border-primary pb-1.5 text-sm font-bold uppercase tracking-wide text-ink">
                  {g}
                  <span className="ml-2 font-normal normal-case text-muted-foreground">
                    {failing.length} failing
                  </span>
                </h2>
                <ul className="mt-2 divide-y divide-border">
                  {[...failing, ...list.filter((p) => p.ok)].map((p) => (
                    <li
                      key={p.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{p.name}</p>
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate text-xs text-muted-foreground hover:text-primary"
                        >
                          {p.url}
                        </a>
                        {p.note && <p className="text-xs text-destructive">{p.note}</p>}
                      </div>
                      <span
                        className={`shrink-0 rounded-sm px-2 py-0.5 text-xs font-bold ${
                          p.ok
                            ? "bg-emerald-700 text-white"
                            : "bg-destructive text-destructive-foreground"
                        }`}
                      >
                        {p.ok ? "OK" : (p.status ?? "DOWN")} · {p.ms}ms
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          <p className="mt-8 text-xs text-muted-foreground">
            Checked {new Date(report.checkedAt).toLocaleString()}
          </p>
        </>
      )}
    </div>
  );
}