import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  CITY_SLUGS,
  REGION_SLUGS,
  EMPTY_CITY_NOTES,
  templesInCity,
  templesNearCity,
  templesInRegion,
  type TempleRegion,
} from "@/lib/temple-directory";
import { TempleCard } from "@/components/temple-card";

type Match =
  | { kind: "city"; name: string; region: TempleRegion; slug: string }
  | { kind: "region"; name: TempleRegion; slug: string };

function resolve(slug: string): Match | null {
  const city = CITY_SLUGS.find((c) => c.slug === slug);
  if (city) return { kind: "city", name: city.en, region: city.region, slug };
  const region = REGION_SLUGS.find((r) => r.slug === slug);
  if (region) return { kind: "region", name: region.en, slug };
  return null;
}

export const Route = createFileRoute("/temples/$city")({
  loader: ({ params }) => {
    const match = resolve(params.city);
    if (!match) throw notFound();
    return { match };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Temples not found — Times Bay Area" }, { name: "robots", content: "noindex" }] };
    }
    const name = loaderData.match.name;
    const title = `Hindu Temples in ${name} — Bay Area Temple Directory | Times Bay Area`;
    const desc = `Verified Hindu temples and spiritual centers in ${name}, with addresses, directions, websites and upcoming events.`;
    const url = canonical(`/temples/${loaderData.match.slug}`);
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: TempleCityNotFound,
  errorComponent: TempleCityNotFound,
  component: TempleCityPage,
});

function TempleCityNotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-ink">We could not find that place</h1>
      <Link to="/temples" className="mt-4 inline-block font-semibold text-primary">
        Back to the temple directory
      </Link>
    </div>
  );
}

function TempleCityPage() {
  const { match } = Route.useLoaderData();
  const inPlace =
    match.kind === "city"
      ? [...templesInCity(match.name), ...templesNearCity(match.name)]
      : templesInRegion(match.name);
  const note = match.kind === "city" ? EMPTY_CITY_NOTES[match.name] : undefined;
  const regionName = match.kind === "city" ? match.region : match.name;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <nav className="text-xs text-muted-foreground" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-primary">
          Home
        </Link>{" "}
        ›{" "}
        <Link to="/temples" className="hover:text-primary">
          Temples
        </Link>{" "}
        › <span className="text-ink">{match.name}</span>
      </nav>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: `Hindu temples in ${match.name}`,
            itemListElement: inPlace.map((t, i) => ({
              "@type": "ListItem",
              position: i + 1,
              item: {
                "@type": "PlaceOfWorship",
                name: t.name,
                address: t.address,
                url: t.website,
              },
            })),
          }),
        }}
      />

      <h1 className="mt-2 text-2xl font-bold text-ink md:text-3xl">
        Hindu Temples in {match.name}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {regionName} · {inPlace.length} verified listing{inPlace.length === 1 ? "" : "s"}
      </p>

      {inPlace.length === 0 && (
        <div className="mt-5 border border-border bg-surface-tint p-5">
          <p className="text-sm text-ink">
            {note?.message ?? `No verified temple currently listed in ${match.name}.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(note?.nearby ?? []).map((n) => {
              const slug = CITY_SLUGS.find((c) => c.en === n)?.slug;
              return slug ? (
                <Link
                  key={n}
                  to="/temples/$city"
                  params={{ city: slug }}
                  className="min-h-9 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold text-ink"
                >
                  Temples in {n}
                </Link>
              ) : null;
            })}
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {inPlace.map((t) => (
          <TempleCard key={t.id} temple={t} />
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {CITY_SLUGS.filter((c) => c.region === regionName && c.en !== match.name).map((c) => (
          <Link
            key={c.slug}
            to="/temples/$city"
            params={{ city: c.slug }}
            className="min-h-9 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold text-ink"
          >
            {c.en}
          </Link>
        ))}
      </div>
    </div>
  );
}
