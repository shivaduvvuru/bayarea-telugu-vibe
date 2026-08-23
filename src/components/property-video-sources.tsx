import { useState } from "react";
import { Check, ExternalLink, Video } from "lucide-react";
import { videoTourOutlook } from "@/lib/property-videos";

const TONE: Record<string, string> = {
  "Very likely": "bg-primary/15 text-primary",
  Likely: "bg-primary/10 text-primary",
  Possible: "bg-muted text-muted-foreground",
  Unlikely: "bg-muted text-muted-foreground",
};

/**
 * Shown in place of a player when no verified short clip exists yet: a
 * per-property sourcing checklist with direct search links and an estimated
 * confidence for each source, plus an overall outlook for the project.
 */
export function PropertyVideoSources({
  project,
  developer,
  location,
  note,
  site,
}: {
  project: string;
  developer: string;
  location?: string;
  note?: string;
  site?: string;
}) {
  const outlook = videoTourOutlook({
    project,
    developer,
    ...(location ? { location } : {}),
    ...(note ? { note } : {}),
    ...(site ? { site } : {}),
  });
  const [done, setDone] = useState<string[]>([]);
  const toggle = (id: string) =>
    setDone((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <section
      aria-label={`Find video tours for ${project}`}
      className="rounded-lg border border-dashed border-border bg-muted/40 p-2"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          <Video className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Find video tours
        </p>
        <span
          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${TONE[outlook.label]}`}
          title={outlook.reason}
        >
          {outlook.label} · {outlook.score}%
        </span>
      </div>
      <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{outlook.reason}</p>

      <ul className="mt-1.5 space-y-1.5">
        {outlook.steps.map((s) => {
          const checked = done.includes(s.id);
          return (
            <li key={s.id} className="flex items-start gap-1.5">
              <button
                type="button"
                onClick={() => toggle(s.id)}
                aria-pressed={checked}
                aria-label={`Mark ${s.label} as checked`}
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                  checked
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background"
                }`}
              >
                {checked ? <Check className="h-3 w-3" aria-hidden /> : null}
              </button>
              <div className="min-w-0 flex-1">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="group block"
                >
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold group-hover:underline ${
                      checked ? "text-muted-foreground line-through" : "text-primary"
                    }`}
                  >
                    {s.label}
                    <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                  </span>
                  <span className="block text-[11px] leading-snug text-muted-foreground">
                    {s.hint}
                  </span>
                </a>
                <div className="mt-1 flex items-center gap-1.5">
                  <span
                    className="h-1 w-16 overflow-hidden rounded-full bg-border"
                    aria-hidden
                  >
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${s.confidence}%` }}
                    />
                  </span>
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    {s.confidence}% hit rate
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        No verified clip on file yet — our desk publishes one once it is checked.
      </p>
    </section>
  );
}
