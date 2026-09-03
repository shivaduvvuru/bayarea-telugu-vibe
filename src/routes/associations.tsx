import { createFileRoute } from "@tanstack/react-router";
import { CommunityAppeal } from "@/components/ads";
import { ASSOCIATIONS, BAY_AREA_TEMPLES } from "@/lib/community-data";

const TITLE = "Indian Associations in the Bay Area — BATA, TANA, ATA & more";
...
  "BATA, Silicon Andhra, TANA Bay Area, ATA Bay Area, TDF, NRI TDP and IT Serve — the Indian associations serving the San Francisco Bay Area.";

export const Route = createFileRoute("/associations")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssociationsPage,
});

function AssociationsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Community</p>
      <h1 className="mt-2 text-3xl font-bold text-ink md:text-4xl">Associations</h1>
      <p className="mt-3 text-[17px] leading-relaxed text-foreground">
        The Indian associations that organise cultural, social and professional life across the
        Bay Area.
      </p>

      <ol className="mt-8 space-y-4">
        {ASSOCIATIONS.map((a, i) => (
          <li
            key={a.short}
            className="flex gap-4 border-l-4 border-primary bg-surface-tint px-4 py-4"
          >
            <span className="text-lg font-bold text-primary">{i + 1}</span>
            <div>
              <h2 className="text-lg font-bold text-ink">{a.name}</h2>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {a.short}
              </p>
              <p className="mt-1.5 text-sm text-foreground">{a.blurb}</p>
              <a
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-sm font-semibold text-primary hover:underline"
              >
                Visit website
              </a>
            </div>
          </li>
        ))}
      </ol>

      <h2 className="mt-12 border-b-2 border-primary pb-2 text-xl font-bold text-ink">
        Temples we cover
      </h2>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {BAY_AREA_TEMPLES.map((tpl) => (
          <li key={tpl.name} className="border border-border px-4 py-3">
            <p className="text-sm font-semibold text-ink">{tpl.name}</p>
            <p className="text-xs text-muted-foreground">
              {tpl.city} — {tpl.note}
            </p>
          </li>
        ))}
      </ul>

      <CommunityAppeal what="associations and groups" />
    </div>
  );
}