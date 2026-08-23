import { ExternalLink, Video } from "lucide-react";
import { recommendedVideoSources } from "@/lib/property-videos";

/**
 * Shown in place of a player when no verified short clip exists yet: a small
 * set of recommended places readers can look for a walkthrough.
 */
export function PropertyVideoSources({
  project,
  developer,
  site,
}: {
  project: string;
  developer: string;
  site?: string;
}) {
  const sources = recommendedVideoSources({ project, developer, ...(site ? { site } : {}) });
  return (
    <section
      aria-label={`Find video tours for ${project}`}
      className="rounded-lg border border-dashed border-border bg-muted/40 p-2"
    >
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        <Video className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Find video tours
      </p>
      <ul className="mt-1.5 space-y-1.5">
        {sources.map((s) => (
          <li key={s.label}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="group block"
            >
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:underline">
                {s.label}
                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
              </span>
              <span className="block text-[11px] leading-snug text-muted-foreground">{s.hint}</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        No verified clip on file yet — our desk publishes one once it is checked.
      </p>
    </section>
  );
}
