import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listSyndicationAdmin, runSyndicationNow, updateSyndicatedStory } from "@/lib/syndicated.functions";

export const Route = createFileRoute("/_authenticated/admin/syndication")({
  head: () => ({
    meta: [
      { title: "New India Abroad sync — Times Bay Area" },
      { name: "description", content: "Operational view for the New India Abroad City News feed." },
      { property: "og:title", content: "New India Abroad sync — Times Bay Area" },
      { property: "og:description", content: "Operational view for the New India Abroad City News feed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SyndicationAdmin,
});

function SyndicationAdmin() {
  const qc = useQueryClient();
  const load = useServerFn(listSyndicationAdmin);
  const run = useServerFn(runSyndicationNow);
  const update = useServerFn(updateSyndicatedStory);
  const query = useQuery({ queryKey: ["syndication-admin"], queryFn: () => load({}), staleTime: 30_000 });
  const [editing, setEditing] = useState<Record<string, string>>({});
  const runMutation = useMutation({
    mutationFn: () => run({}),
    onSuccess: (result) => {
      toast.success(`${result.inserted} new story${result.inserted === 1 ? "" : "ies"} fetched.`);
      qc.invalidateQueries({ queryKey: ["syndication-admin"] });
      qc.invalidateQueries({ queryKey: ["category", "city-news"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const updateMutation = useMutation({
    mutationFn: (input: { id: string; status: "published" | "hidden"; excerpt?: string | null }) => update({ data: input }),
    onSuccess: () => {
      toast.success("Story updated.");
      qc.invalidateQueries({ queryKey: ["syndication-admin"] });
      qc.invalidateQueries({ queryKey: ["category", "city-news"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">New India Abroad</h1>
          <p className="text-sm text-muted-foreground">Stories publish automatically. Use this screen only to hide or refine a story.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link to="/admin">Newsroom</Link></Button>
          <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>{runMutation.isPending ? "Fetching…" : "Fetch now"}</Button>
        </div>
      </header>
      {query.isLoading ? <p className="mt-8 text-sm text-muted-foreground">Loading stories…</p> : null}
      {query.isError ? <p role="alert" className="mt-8 text-sm text-destructive">{(query.error as Error).message}</p> : null}
      <section className="mt-8">
        <h2 className="border-b-2 border-primary pb-2 text-sm font-bold uppercase tracking-wide text-ink">Recent stories</h2>
        <div className="mt-4 divide-y divide-border">
          {(query.data?.stories ?? []).map((story) => {
            const draft = editing[story.id] ?? story.excerpt ?? "";
            return (
              <article key={story.id} className="grid gap-4 py-5 md:grid-cols-[180px_minmax(0,1fr)_auto]">
                {story.image_url ? <img src={story.image_url} alt="" className="aspect-video w-full object-cover" loading="lazy" /> : <div className="aspect-video bg-surface-tint" />}
                <div className="min-w-0">
                  <a href={story.canonical_url} target="_blank" rel="nofollow noopener noreferrer" className="font-semibold headline-link">{story.title} <ArrowUpRight className="inline h-3.5 w-3.5" aria-hidden /></a>
                  <p className="mt-1 text-xs text-muted-foreground">{story.status} · {story.source_category ?? "news"}</p>
                  <Input className="mt-3" value={draft} onChange={(event) => setEditing((current) => ({ ...current, [story.id]: event.target.value }))} aria-label={`Excerpt for ${story.title}`} />
                  <Button className="mt-2" size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: story.id, status: story.status === "published" ? "published" : "hidden", excerpt: draft })} disabled={updateMutation.isPending}>Save excerpt</Button>
                </div>
                <Button size="sm" variant={story.status === "published" ? "outline" : "default"} onClick={() => updateMutation.mutate({ id: story.id, status: story.status === "published" ? "hidden" : "published", excerpt: draft })} disabled={updateMutation.isPending}>{story.status === "published" ? "Hide" : "Publish"}</Button>
              </article>
            );
          })}
        </div>
      </section>
      <section className="mt-10">
        <h2 className="border-b-2 border-primary pb-2 text-sm font-bold uppercase tracking-wide text-ink">Fetch history</h2>
        <ul className="divide-y divide-border text-sm">
          {(query.data?.runs ?? []).map((run) => <li key={run.id} className="grid gap-1 py-3 sm:grid-cols-[1fr_auto]"><span>{run.trigger} · {run.new_count ?? 0} new of {run.fetched_count ?? 0} candidates</span><span className={run.error ? "text-destructive" : "text-muted-foreground"}>{run.error ?? `${run.elapsed_ms ?? 0} ms`}</span></li>)}
        </ul>
      </section>
    </div>
  );
}
