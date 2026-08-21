import { Link } from "@tanstack/react-router";
import { BadgeCheck, Building2 } from "lucide-react";
import { developerLineup, priceLabel, type Property } from "@/lib/property";

/**
 * "Meet these developers" — confirmed participants grouped by developer, with
 * Telugu Times advertisers surfaced first and links straight to project pages.
 */
export function DeveloperLineup({
  campaignSlug,
  properties,
}: {
  campaignSlug: string;
  properties: Property[];
}) {
  const developers = developerLineup(properties);
  if (developers.length === 0) return null;

  return (
    <section id="developers" className="mt-8">
      <h2 className="border-b-2 border-primary pb-1 text-sm font-bold uppercase tracking-wide text-ink">
        Meet these developers
      </h2>
      <p className="mt-2 text-xs text-muted-foreground">
        Confirmed participating developers. A “Telugu Times advertiser” badge means the developer
        also advertises with us — participation itself is listed as published by the organiser.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {developers.map((d) => (
          <article key={d.name} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-start gap-2">
              {d.logo ? (
                <img
                  src={d.logo}
                  alt={`${d.name} logo`}
                  loading="lazy"
                  className="h-10 w-10 shrink-0 rounded object-contain"
                />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-surface-tint">
                  <Building2 className="h-5 w-5 text-primary" aria-hidden />
                </span>
              )}
              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold text-ink">{d.name}</h3>
                <p className="text-[11px] text-muted-foreground">
                  {d.projects.length} project{d.projects.length === 1 ? "" : "s"}
                  {d.localities.length ? ` · ${d.localities.slice(0, 2).join(", ")}` : ""}
                </p>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {d.isAdvertiser ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                  <BadgeCheck className="h-3 w-3" aria-hidden /> Telugu Times advertiser
                </span>
              ) : null}
              {d.isParticipant ? (
                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Confirmed participant
                </span>
              ) : null}
            </div>

            <ul className="mt-2 space-y-1.5">
              {d.projects.map((p) => (
                <li key={p.id} className="text-xs">
                  <Link
                    to="/property/$campaign/$slug"
                    params={{ campaign: campaignSlug, slug: p.slug }}
                    className="font-bold text-primary hover:underline"
                  >
                    {p.project_name}
                  </Link>
                  <span className="text-muted-foreground">
                    {" "}
                    · {priceLabel(p)}
                    {p.locality ? ` · ${p.locality}` : ""}
                  </span>
                </li>
              ))}
            </ul>

            <a
              href="#projects"
              className="mt-2 inline-block text-[11px] font-bold uppercase tracking-wide text-muted-foreground hover:text-primary"
            >
              See project cards
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
