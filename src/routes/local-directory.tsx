import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { directoryCategoryCounts, searchDirectory } from "@/lib/directory.functions";
import {
  COMMUNITY_TAGS,
  DIRECTORY_TAXONOMY,
  subcategoriesFor,
} from "@/lib/directory-taxonomy";
import { BAY_AREA_COUNTIES } from "@/lib/directory-geo";
import { COMMUNITY_EMAIL } from "@/lib/community-data";
import type { DirectoryEntity } from "@/lib/directory";

const TITLE = "Bay Area Local Directory — Times Bay Area";
const DESC =
  "Temples, restaurants, doctors, tutors, trades, shops and civic offices across all nine Bay Area counties.";

const countsQuery = queryOptions({
  queryKey: ["local-directory", "counts"],
  queryFn: () => directoryCategoryCounts(),
  staleTime: 10 * 60 * 1000,
});

export const Route = createFileRoute("/local-directory")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(countsQuery);
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
  component: LocalDirectoryPage,
});

function LocalDirectoryPage() {
  const { data: counts } = useSuspenseQuery(countsQuery);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [county, setCounty] = useState("");
  const [city, setCity] = useState("");
  const [community, setCommunity] = useState("");
  const [verified, setVerified] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const countFor = (key: string) =>
    counts.categories.find((c) => c.key === key)?.total ?? 0;

  const cityOptions = useMemo(() => {
    const inCounty = county
      ? (BAY_AREA_COUNTIES.find((c) => c.key === county)?.cities ?? []).map((c) => c.name)
      : null;
    return counts.cities.filter((c) => !inCounty || inCounty.includes(c.city));
  }, [counts.cities, county]);

  const results = useQuery({
    queryKey: ["local-directory", "search", { q, category, subcategory, county, city, community, verified }],
    queryFn: () =>
      searchDirectory({
        data: {
          q,
          category,
          subcategory,
          county: county
            ? (BAY_AREA_COUNTIES.find((c) => c.key === county)?.name ?? "")
            : "",
          city,
          community,
          verified,
          limit: 120,
        },
      }),
    staleTime: 60 * 1000,
  });

  const rows = (results.data ?? []) as DirectoryEntity[];
  const activeCount = [category, subcategory, county, city, community].filter(Boolean).length + (verified ? 1 : 0);

  const reset = () => {
    setQ("");
    setCategory("");
    setSubcategory("");
    setCounty("");
    setCity("");
    setCommunity("");
    setVerified(false);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold text-ink">Bay Area Local Directory</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        {counts.total.toLocaleString()} listings across all nine counties — built on open data, free
        for the community, and correctable by the owners themselves.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="ld-search">
          Search the directory
        </label>
        <input
          id="ld-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or keyword..."
          className="min-h-11 w-full max-w-sm rounded-sm border border-border bg-background px-3 text-base text-ink"
        />
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className="min-h-11 rounded-sm border border-border px-4 text-sm font-semibold text-ink hover:border-primary"
          aria-expanded={showFilters}
        >
          Filters{activeCount > 0 ? ` (${activeCount})` : ""}
        </button>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={reset}
            className="min-h-11 rounded-sm border border-border px-4 text-sm font-semibold text-ink hover:border-primary"
          >
            Clear
          </button>
        )}
      </div>

      {/* Category rail: compact, horizontally scrollable on phones. */}
      <div className="mt-4 -mx-4 overflow-x-auto px-4">
        <div className="flex gap-2 pb-1">
          <button
            type="button"
            onClick={() => {
              setCategory("");
              setSubcategory("");
            }}
            className={`min-h-9 shrink-0 rounded-full border px-3 text-xs font-semibold ${
              category === "" ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground"
            }`}
          >
            All
          </button>
          {DIRECTORY_TAXONOMY.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => {
                setCategory(category === c.key ? "" : c.key);
                setSubcategory("");
              }}
              className={`min-h-9 shrink-0 rounded-full border px-3 text-xs font-semibold ${
                category === c.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-foreground"
              }`}
            >
              {c.label}
              <span className="ml-1 font-normal text-muted-foreground">{countFor(c.key)}</span>
            </button>
          ))}
        </div>
      </div>

      {showFilters && (
        <div className="mt-3 grid gap-3 rounded-sm border border-border bg-surface-tint p-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Subcategory
            <select
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              disabled={!category}
              className="mt-1 min-h-10 w-full rounded-sm border border-border bg-background px-2 text-sm font-normal normal-case text-ink"
            >
              <option value="">All</option>
              {subcategoriesFor(category).map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            County
            <select
              value={county}
              onChange={(e) => {
                setCounty(e.target.value);
                setCity("");
              }}
              className="mt-1 min-h-10 w-full rounded-sm border border-border bg-background px-2 text-sm font-normal normal-case text-ink"
            >
              <option value="">All counties</option>
              {BAY_AREA_COUNTIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            City
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="mt-1 min-h-10 w-full rounded-sm border border-border bg-background px-2 text-sm font-normal normal-case text-ink"
            >
              <option value="">All cities</option>
              {cityOptions.map((c) => (
                <option key={c.city} value={c.city}>
                  {c.city} ({c.total})
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Community relevance
            <select
              value={community}
              onChange={(e) => setCommunity(e.target.value)}
              className="mt-1 min-h-10 w-full rounded-sm border border-border bg-background px-2 text-sm font-normal normal-case text-ink"
            >
              <option value="">Everything</option>
              {COMMUNITY_TAGS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
              className="size-4"
            />
            Owner-verified only
          </label>
        </div>
      )}

      <p className="mt-5 text-sm text-muted-foreground" aria-live="polite">
        {results.isPending
          ? "Loading listings…"
          : `${rows.length} listing${rows.length === 1 ? "" : "s"}`}
      </p>

      {results.error && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {results.error instanceof Error ? results.error.message : "Search failed."}
        </p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((e) => (
          <article key={e.id} className="flex flex-col border border-border p-4">
            <h2 className="text-base font-bold text-ink">{e.name}</h2>
            <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
              {[e.city, e.county].filter(Boolean).join(" · ")}
            </p>
            {e.description && (
              <p className="mt-2 text-sm text-muted-foreground">{e.description}</p>
            )}
            <dl className="mt-2 space-y-0.5 text-xs text-foreground">
              {e.address && (
                <div>
                  <dt className="inline font-semibold">Address: </dt>
                  <dd className="inline">{e.address}</dd>
                </div>
              )}
              {e.hours && (
                <div>
                  <dt className="inline font-semibold">Hours: </dt>
                  <dd className="inline">{e.hours}</dd>
                </div>
              )}
              {e.accessibility && (
                <div>
                  <dt className="inline font-semibold">Access: </dt>
                  <dd className="inline">{e.accessibility}</dd>
                </div>
              )}
            </dl>
            {(e.community_tags.length > 0 || e.service_tags.length > 0) && (
              <ul className="mt-2 flex flex-wrap gap-1">
                {[...e.community_tags, ...e.service_tags].slice(0, 5).map((t) => (
                  <li
                    key={t}
                    className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
              {e.phone && (
                <a href={`tel:${e.phone.replace(/\s+/g, "")}`} className="text-primary hover:underline">
                  Call
                </a>
              )}
              {e.website && (
                <a
                  href={e.website}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-primary hover:underline"
                >
                  Website
                </a>
              )}
              {e.latitude != null && e.longitude != null && (
                <a
                  href={`https://www.openstreetmap.org/?mlat=${e.latitude}&mlon=${e.longitude}#map=17/${e.latitude}/${e.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Map
                </a>
              )}
              <a
                href={`mailto:${COMMUNITY_EMAIL}?subject=${encodeURIComponent(`Directory correction: ${e.name}`)}`}
                className="text-muted-foreground hover:text-primary hover:underline"
              >
                Suggest a correction
              </a>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {e.verified_status ? "Owner verified · " : ""}
              {e.attribution ?? "Community listing"}
            </p>
          </article>
        ))}
      </div>

      {!results.isPending && rows.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">
          Nothing here yet for this filter. Email{" "}
          <a href={`mailto:${COMMUNITY_EMAIL}`} className="font-semibold text-primary hover:underline">
            {COMMUNITY_EMAIL}
          </a>{" "}
          to add a listing.
        </p>
      )}
    </div>
  );
}
