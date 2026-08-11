import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listDirectory } from "@/lib/content.functions";
import { listClaimOverrides } from "@/lib/claims.functions";
import { ClaimForm } from "@/components/claim-form";
import type { DirectoryEntry } from "@/lib/content";
import { CommunityAppeal } from "@/components/ads";
import { CITY_REGIONS } from "@/lib/content";
import { regionOf, resolveCity } from "@/lib/directory-city";
import {
  COMMUNITY_EMAIL,
  DIRECTORY_CATEGORIES,
} from "@/lib/community-data";

const TITLE = "Community Directory — Bay Area Telugu Times";
const DESC =
  "Temples, associations and Telugu community organisations across the San Francisco Bay Area.";

const directoryQuery = queryOptions({
  queryKey: ["wp", "directory"],
  queryFn: () => listDirectory(),
});

const overridesQuery = queryOptions({
  queryKey: ["directory", "claim-overrides"],
  queryFn: () => listClaimOverrides(),
  staleTime: 5 * 60 * 1000,
});

export const Route = createFileRoute("/directory")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(directoryQuery);
    context.queryClient.ensureQueryData(overridesQuery);
  },
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
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center" role="alert">
      <p className="text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  component: DirectoryPage,
});

function DirectoryPage() {
  const { data: entries } = useSuspenseQuery(directoryQuery);
  const { data: overrides } = useSuspenseQuery(overridesQuery);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<number | null>(null);

  // Verified owner corrections win over whatever we could parse from WordPress.
  const byListing = useMemo(() => {
    const map = new Map<number, (typeof overrides)[number]>();
    for (const o of overrides) map.set(o.listing_id, o);
    return map;
  }, [overrides]);

  const text = (e: DirectoryEntry) =>
    `${e.title} ${e.excerpt} ${e.category ?? ""}`.toLowerCase();
  // Each listing is assigned to one of the 16 Bay Area cities once, from its
  // address line, so the Location filter and the city labels agree.
  const cityOf = useMemo(() => {
    const map = new Map<number, string | null>();
    for (const e of entries) {
      map.set(e.id, byListing.get(e.id)?.city ?? resolveCity(e.title, e.excerpt));
    }
    return map;
  }, [entries, byListing]);
  // Category buttons prefer the real WordPress taxonomy term and fall back to
  // a text match, so grocery listings land under Super Markets either way.
  const inCategory = (e: DirectoryEntry, term: string) => {
    // Tolerate plural/singular differences between our labels ("Restaurants")
    // and the WordPress terms ("Restaurant").
    const t = term.toLowerCase().split(" /")[0]!.replace(/s$/, "");
    return e.category ? e.category.toLowerCase().includes(t) : text(e).includes(t);
  };
  const count = (term: string) => entries.filter((e) => inCategory(e, term)).length;
  const cityCount = (name: string) =>
    entries.filter((e) => cityOf.get(e.id) === name).length;

  const filtered = useMemo(
    () =>
      entries.filter((e) => {
        const hay = text(e);
        if (q && !hay.includes(q.toLowerCase())) return false;
        if (category && !inCategory(e, category)) return false;
        if (city && cityOf.get(e.id) !== city) return false;
        return true;
      }),
    [entries, q, category, city, cityOf],
  );

  // Listings are grouped region-first (South Bay, East Bay, Peninsula, ...)
  // and then city by city inside each region.
  const grouped = useMemo(() => {
    const byCity = new Map<string, DirectoryEntry[]>();
    for (const e of filtered) {
      const key = cityOf.get(e.id) ?? "Elsewhere in the Bay Area";
      const list = byCity.get(key);
      if (list) list.push(e);
      else byCity.set(key, [e]);
    }
    const regions = CITY_REGIONS.map((r) => ({
      region: r.en,
      regionTe: r.te,
      cities: r.cities
        .filter((c) => byCity.has(c.en))
        .map((c) => ({ city: c.en, cityTe: c.te, items: byCity.get(c.en)! })),
    }));
    if (byCity.has("Elsewhere in the Bay Area")) {
      regions.push({
        region: "Elsewhere in the Bay Area",
        regionTe: "బే ఏరియా ఇతర ప్రాంతాలు",
        cities: [
          {
            city: "Elsewhere in the Bay Area",
            cityTe: "",
            items: byCity.get("Elsewhere in the Bay Area")!,
          },
        ],
      });
    }
    return regions.filter((r) => r.cities.length > 0);
  }, [filtered, cityOf]);

  const reset = () => {
    setQ("");
    setCategory(null);
    setCity(null);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold text-ink">Community Directory</h1>
      <p className="te-text mt-1 text-sm text-muted-foreground">డైరెక్టరీ</p>
      <p className="mt-3 rounded-sm border border-border bg-surface-tint px-4 py-3 text-sm text-foreground">
        Do you want your business house to be included in our Directory? Please send the
        information to{" "}
        <a href={`mailto:${COMMUNITY_EMAIL}`} className="font-semibold text-primary hover:underline">
          {COMMUNITY_EMAIL}
        </a>
        .
      </p>

      <div className="mt-6 flex gap-2">
        <label className="sr-only" htmlFor="dir-search">
          Search directory
        </label>
        <input
          id="dir-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search directory..."
          className="min-h-11 w-full max-w-md rounded-sm border border-border bg-background px-3 text-base text-ink"
        />
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded-sm border border-border px-4 text-sm font-semibold text-ink hover:border-primary"
        >
          Reset
        </button>
      </div>

      {/* Column 1: statistics. Columns 2-4: listings. */}
      <div className="mt-6 grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-6">
          <div>
            <h2 className="border-b-2 border-primary pb-1.5 text-sm font-bold uppercase tracking-wide text-ink">
              Category
            </h2>
            <ul className="mt-2">
              {DIRECTORY_CATEGORIES.map((c) => (
                <li key={c}>
                  <button
                    type="button"
                    onClick={() => setCategory(category === c ? null : c)}
                    className={`flex min-h-9 w-full items-center justify-between gap-2 text-left text-sm ${
                      category === c ? "font-bold text-primary" : "text-foreground"
                    }`}
                  >
                    <span className="min-w-0 truncate">{c}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{count(c)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="border-b-2 border-primary pb-1.5 text-sm font-bold uppercase tracking-wide text-ink">
              Location
            </h2>
            {CITY_REGIONS.map((r) => (
              <div key={r.key} className="mt-3">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {r.en}
                </p>
                <ul className="mt-1">
                  {r.cities.map((c) => (
                    <li key={c.slug}>
                      <button
                        type="button"
                        onClick={() => setCity(city === c.en ? null : c.en)}
                        className={`flex min-h-9 w-full items-center justify-between gap-2 text-left text-sm ${
                          city === c.en ? "font-bold text-primary" : "text-foreground"
                        }`}
                      >
                        <span className="min-w-0 truncate">{c.en}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {cityCount(c.en)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        <div>
          <p className="mb-3 text-sm text-muted-foreground">
            {filtered.length} listing{filtered.length === 1 ? "" : "s"}
            {category ? ` in ${category}` : ""}
            {city ? ` — ${city}, ${regionOf(city)}` : ""}
          </p>
          {filtered.length === 0 ? (
            <p className="text-muted-foreground">No listings match this filter yet.</p>
          ) : (
            <div className="space-y-10">
              {grouped.map((region) => (
                <section key={region.region}>
                  <h2 className="border-b-2 border-primary pb-1.5 text-lg font-bold text-ink">
                    {region.region}
                    <span className="te-text mt-0.5 block text-xs font-medium text-muted-foreground">
                      {region.regionTe}
                    </span>
                  </h2>
                  {region.cities.map((group) => (
                <section key={group.city} className="mt-6">
                  <h3 className="border-b border-border pb-1.5 text-sm font-bold uppercase tracking-wide text-ink">
                    {group.city === "Elsewhere in the Bay Area" ? (
                      group.city
                    ) : (
                      <Link
                        to="/city/$city"
                        params={{
                          city: group.city.toLowerCase().replace(/\s+/g, "-"),
                        }}
                        className="hover:text-primary"
                      >
                        {group.city}
                      </Link>
                    )}
                    <span className="ml-2 font-normal normal-case text-muted-foreground">
                      {group.items.length} listing{group.items.length === 1 ? "" : "s"}
                    </span>
                  </h3>
                  <div className="mt-4 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {group.items.map((e) => (
                <article key={e.id} className="border border-border">
                  {e.image && (
                    <img
                      src={e.image}
                      alt={e.title}
                      loading="lazy"
                      width={600}
                      height={400}
                      className="aspect-[3/2] w-full object-cover"
                    />
                  )}
                  <div className="p-4">
                    <h3 className="text-lg font-bold text-ink">{e.title}</h3>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-primary">
                      {[e.category, cityOf.get(e.id)].filter(Boolean).join(" · ")}
                    </p>
                    {e.excerpt && (
                      <p className="mt-2 text-sm text-muted-foreground">{e.excerpt}</p>
                    )}
                    {e.duplicates && e.duplicates.length > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {e.duplicates.length + 1} listings merged
                      </p>
                    )}
                    {(() => {
                      const o = byListing.get(e.id);
                      return o ? (
                        <dl className="mt-2 space-y-0.5 text-xs text-foreground">
                          {o.hours && (
                            <div>
                              <dt className="inline font-semibold">Hours: </dt>
                              <dd className="inline">{o.hours}</dd>
                            </div>
                          )}
                          {o.phone && (
                            <div>
                              <dt className="inline font-semibold">Phone: </dt>
                              <dd className="inline">{o.phone}</dd>
                            </div>
                          )}
                          {o.address && (
                            <div>
                              <dt className="inline font-semibold">Address: </dt>
                              <dd className="inline">{o.address}</dd>
                            </div>
                          )}
                          <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                            Owner verified
                          </p>
                        </dl>
                      ) : null;
                    })()}
                    {claiming === e.id ? (
                      <ClaimForm
                        listingId={e.id}
                        listingTitle={e.title}
                        suggestedCity={cityOf.get(e.id) ?? null}
                        onClose={() => setClaiming(null)}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setClaiming(e.id)}
                        className="mt-3 min-h-11 rounded-sm border border-border px-3 text-xs font-semibold text-ink hover:border-primary hover:text-primary"
                      >
                        Is this your business? Claim &amp; correct
                      </button>
                    )}
                  </div>
                </article>
                    ))}
                  </div>
                </section>
                  ))}
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      <CommunityAppeal what="business houses" />
    </div>
  );
}
