import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { UpdatedStamp } from "@/components/freshness";
import templeSnapshot from "@/content/temple-snapshot.json";
import {
  TEMPLES,
  REGION_SLUGS,
  CITY_SLUGS,
  INTEREST_FILTERS,
  matchesInterest,
  matchesQuery,
  EMPTY_CITY_NOTES,
  type TempleRegion,
} from "@/lib/temple-directory";
import { TempleCard } from "@/components/temple-card";
import { COMMUNITY_EMAIL } from "@/lib/community-data";

const TITLE = "Bay Area Temple Directory — Hindu Temples by City | Telugu Times";
const DESC =
  "Verified Hindu temples and Indian spiritual centers across the Bay Area, organized by South Bay, East Bay, Peninsula and San Francisco with directions, websites and events.";

export const Route = createFileRoute("/temples/")({
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
  component: TempleDirectoryPage,
});

const chip = (active: boolean) =>
  `min-h-9 shrink-0 rounded-full border px-3 text-sm font-semibold ${
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-card text-ink"
  }`;

function TempleDirectoryPage() {
  const [q, setQ] = useState("");
  const [region, setRegion] = useState<TempleRegion | "all">("all");
  const [city, setCity] = useState<string | "all">("all");
  const [interest, setInterest] = useState<string | null>(null);

  const cities = useMemo(
    () => CITY_SLUGS.filter((c) => region === "all" || c.region === region),
    [region],
  );

  const results = useMemo(
    () =>
      TEMPLES.filter(
        (t) =>
          (region === "all" || t.region === region) &&
          (city === "all" || t.city === city || t.nearby_city === city) &&
          (!interest || matchesInterest(t, interest)) &&
          matchesQuery(t, q),
      ),
    [q, region, city, interest],
  );

  const grouped = REGION_SLUGS.map((r) => ({
    region: r.en,
    temples: results
      .filter((t) => t.region === r.en)
      .sort(
        (a, b) =>
          Number(b.featured) - Number(a.featured) ||
          (a.city ?? a.nearby_city ?? "").localeCompare(b.city ?? b.nearby_city ?? "") ||
          a.name.localeCompare(b.name),
      ),
  })).filter((g) => g.temples.length > 0);

  const emptyNote = city !== "all" ? EMPTY_CITY_NOTES[city] : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "/" },
              { "@type": "ListItem", position: 2, name: "Temples", item: "/temples" },
            ],
          }),
        }}
      />
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Community</p>
      <h1 className="mt-1 text-2xl font-bold text-ink md:text-3xl">Bay Area Temple Directory</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {TEMPLES.length} verified temples and spiritual centers across 16 Bay Area cities.
      </p>
      <UpdatedStamp
        at={(templeSnapshot as { generatedAt?: string }).generatedAt ?? null}
        label="Announcements refreshed"
        staleAfterHours={72}
      />

      <label className="mt-4 flex items-center gap-2 border border-border bg-card px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search temple, city or deity"
          className="min-h-11 w-full bg-transparent text-[15px] outline-none"
          aria-label="Search temples"
        />
      </label>

      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        <button className={chip(region === "all")} onClick={() => { setRegion("all"); setCity("all"); }}>
          All regions
        </button>
        {REGION_SLUGS.map((r) => (
          <button
            key={r.slug}
            className={chip(region === r.en)}
            onClick={() => { setRegion(r.en); setCity("all"); }}
          >
            {r.en}
          </button>
        ))}
      </div>

      <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
        <button className={chip(city === "all")} onClick={() => setCity("all")}>
          All cities
        </button>
        {cities.map((c) => (
          <button key={c.slug} className={chip(city === c.en)} onClick={() => setCity(c.en)}>
            {c.en}
          </button>
        ))}
      </div>

      <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
        {INTEREST_FILTERS.map((f) => (
          <button
            key={f.key}
            className={chip(interest === f.key)}
            onClick={() => setInterest(interest === f.key ? null : f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {results.length} temple{results.length === 1 ? "" : "s"}
        {city !== "all" ? ` in ${city}` : region !== "all" ? ` in ${region}` : ""}
      </p>

      {results.length === 0 && (
        <div className="mt-4 border border-border bg-surface-tint p-5">
          <p className="text-sm text-ink">
            {emptyNote?.message ??
              "No temples match these filters yet. Try a different city or clear the search."}
          </p>
          {emptyNote && (
            <div className="mt-3 flex flex-wrap gap-2">
              {emptyNote.nearby.map((n) => (
                <button key={n} className={chip(false)} onClick={() => { setCity(n); setQ(""); }}>
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {grouped.map((g) => (
        <section key={g.region} className="mt-8">
          <h2 className="border-b-2 border-primary pb-2 text-lg font-bold text-ink">
            {g.region}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {g.temples.length}
            </span>
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {g.temples.map((t) => (
              <TempleCard key={t.id} temple={t} />
            ))}
          </div>
        </section>
      ))}

      <section className="mt-10">
        <h2 className="text-base font-bold text-ink">Browse temples by city</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {CITY_SLUGS.map((c) => (
            <Link
              key={c.slug}
              to="/temples/$city"
              params={{ city: c.slug }}
              className="min-h-9 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold text-ink"
            >
              Temples in {c.en}
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-10 border border-border bg-surface-tint p-5">
        <h2 className="text-base font-bold text-ink">Missing a temple?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Suggest a temple or send a correction and our editors will verify it before it appears.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to="/submit"
            className="flex min-h-11 items-center rounded-sm bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            Suggest a temple
          </Link>
          <a
            href={`mailto:${COMMUNITY_EMAIL}`}
            className="flex min-h-11 items-center rounded-sm border border-border px-5 text-sm font-semibold text-ink"
          >
            Email the newsroom
          </a>
        </div>
      </div>
    </div>
  );
}
