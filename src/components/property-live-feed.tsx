import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Radio, Video } from "lucide-react";
import { getLiveFeed } from "@/lib/property.functions";
import type { LivePost } from "@/lib/property";

/**
 * "Live from HITEX" — on-site photos, short videos and booth highlights the
 * editors publish from the desk. Polls every 60s so the show feed stays fresh
 * without a redeploy, and renders nothing when there is nothing to show.
 */
export function PropertyLiveFeed({
  campaignSlug,
  live,
  note,
  venueLabel,
}: {
  campaignSlug: string;
  live: boolean;
  note?: string | null;
  venueLabel: string;
}) {
  const [posts, setPosts] = useState<LivePost[]>([]);
  const load = useServerFn(getLiveFeed);

  useEffect(() => {
    let cancelled = false;
    const run = () =>
      load({ data: { campaignSlug } })
        .then((res) => {
          if (!cancelled) setPosts(res.posts as LivePost[]);
        })
        .catch(() => undefined);
    void run();
    if (!live) return () => {
      cancelled = true;
    };
    const t = setInterval(run, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [campaignSlug, live, load]);

  if (posts.length === 0) return null;

  return (
    <section id="live" className="mt-8">
      <div className="flex flex-wrap items-center gap-2 border-b-2 border-primary pb-1">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink">
          {live ? `Live from ${venueLabel}` : `From ${venueLabel}`}
        </h2>
        {live ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-primary-foreground" aria-hidden />
            Live
          </span>
        ) : null}
      </div>
      {note ? <p className="mt-2 text-xs text-muted-foreground">{note}</p> : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => (
          <article key={p.id} className="overflow-hidden rounded-lg border border-border bg-card">
            {p.kind === "video" && p.media_url ? (
              <video
                src={p.media_url}
                poster={p.poster_url ?? undefined}
                controls
                playsInline
                preload="metadata"
                className="h-44 w-full bg-black object-cover"
              />
            ) : p.media_url ? (
              <img
                src={p.media_url}
                alt={p.title}
                loading="lazy"
                className="h-44 w-full object-cover"
              />
            ) : null}
            <div className="p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                {p.kind === "video" ? (
                  <Video className="h-3 w-3" aria-hidden />
                ) : (
                  <Radio className="h-3 w-3" aria-hidden />
                )}
                {p.kind === "booth" ? "Booth highlight" : p.kind === "video" ? "Video" : "Photo"}
                {p.booth ? ` · Booth ${p.booth}` : ""}
              </p>
              <h3 className="mt-1 text-sm font-bold leading-snug text-ink">{p.title}</h3>
              {p.developer ? (
                <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{p.developer}</p>
              ) : null}
              {p.body ? <p className="mt-1 text-xs text-muted-foreground">{p.body}</p> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
