import { Suspense, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { directoryCategoryCounts, searchDirectory } from "@/lib/directory.functions";
import {
  COMMUNITY_TAGS,
  DIRECTORY_TAXONOMY,
  subcategoriesFor,
} from "@/lib/directory-taxonomy";
import { BAY_AREA_COUNTIES } from "@/lib/directory-geo";
import { COMMUNITY_EMAIL } from "@/lib/community-data";
import {
  CommunityOrgs,
  claimOverridesQuery,
  communityOrgsQuery,
} from "@/components/community-orgs";
import { CommunityAppeal } from "@/components/ads";
import { canonical } from "@/lib/site";
import type { DirectoryEntity } from "@/lib/directory";

const TITLE = "Bay Area Local Directory — Times Bay Area";
const DESC =
  "Temples, restaurants, doctors, tutors, trades, shops, community organisations and civic offices across all nine Bay Area counties.";

const countsQuery = queryOptions({
  queryKey: ["local-directory", "counts"],
  queryFn: () => directoryCategoryCounts(),
  staleTime: 10 * 60 * 1000,
});

/** Filter state lives in the URL so filtered views are shareable and crawlable. */
interface DirectorySearch {
  q?: string;
  category?: string;
  subcategory?: string;
  county?: string;
  city?: string;
  community?: string;
  verified?: boolean;
}

const str = (v: unknown) => (typeof v === "string" && v ? v.slice(0, 80) : undefined);

function countyName(key?: string) {
  if (!key) return "";
  return BAY_AREA_COUNTIES.find((c) => c.key === key)?.name ?? "";
}

const PAGE_SIZE = 120;

function resultsQuery(s: DirectorySearch) {
  return queryOptions({
    queryKey: ["local-directory", "search", s],
    queryFn: () =>
      searchDirectory({
        data: {
          q: s.q ?? "",
          category: s.category ?? "",
          subcategory: s.subcategory ?? "",
          county: countyName(s.county),
          city: s.city ?? "",
          community: s.community ?? "",
          verified: s.verified === true,
          limit: PAGE_SIZE,
        },
      }),
    staleTime: 60 * 1000,
  });
}

export const Route = createFileRoute("/directory/")({
  validateSearch: (search: Record<string, unknown>): DirectorySearch => ({
    q: str(search.q),
    category: str(search.category),
    subcategory: str(search.subcategory),
    county: str(search.county),
    city: str(search.city),
    community: str(search.community),
    verified: search.verified === true || search.verified === "true" ? true : undefined,
  }),
  loaderDeps: ({ search }) => search,
  // The first page of listings is fetched here, not in the browser, so crawlers
  // and the initial HTML both carry real listings instead of a loading state.
  loader: async ({ context, deps }) => {
    context.queryClient.ensureQueryData(countsQuery);
    context.queryClient.prefetchQuery(communityOrgsQuery);
    context.queryClient.prefetchQuery(claimOverridesQuery);
    await context.queryClient.ensureQueryData(resultsQuery(deps));
  },
  head: () => {
    const url = canonical("/directory");
    return {
      meta: [
        { title: TITLE },
        { name: "description", content: DESC },
        { property: "og:title", content: TITLE },
        { property: "og:description", content: DESC },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: TITLE },
        { name: "twitter:description", content: DESC },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Bay Area Local Directory",
            description: DESC,
            url,
            isPartOf: { "@type": "WebSite", name: "Times Bay Area", url: canonical("/") },
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: canonical("/") },
              { "@type": "ListItem", position: 2, name: "Directory", item: url },
            ],
          }),
        },
      ],
    };
  },
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center" role="alert">
      <p className="text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  component: DirectoryPage,
});

function DirectoryPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: counts } = useSuspenseQuery(countsQuery);
  const [qDraft, setQDraft] = useState(search.q ?? "");
  const [showFilters, setShowFilters] = useState(false);

  const patch = (next: Partial<DirectorySearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...next }), replace: true });

  const countFor = (key: string) =>
    counts.categories.find((c) => c.key === key)?.total ?? 0;

  const cityOptions = useMemo(() => {
    const inCounty = search.county
      ? (BAY_AREA_COUNTIES.find((c) => c.key === search.county)?.cities ?? []).map((c) => c.name)
      : null;
    return counts.cities.filter((c) => !inCounty || inCounty.includes(c.city));
  }, [counts.cities, search.county]);

  const results = useQuery(resultsQuery(search));

  const rows = (results.data ?? []) as DirectoryEntity[];
  const activeCount =
    [search.category, search.subcategory, search.county, search.city, search.community].filter(
      Boolean,
    ).length + (search.verified ? 1 : 0);
  // A category with no stored rows yet is still being imported from open data,
  // so we say so rather than showing an empty grid.
  const categoryPending = !!search.category && countFor(search.category) === 0;

  const reset = () => {
    setQDraft("");
    navigate({ search: {}, replace: true });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <ol className="flex items-center gap-1">
          <li>
            <Link to="/" className="hover:text-primary">
              Home
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li className="font-semibold text-ink">Directory</li>
        </ol>
      </nav>
      <h1 className="mt-2 text-3xl font-bold text-ink">Bay Area Local Directory</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        {counts.total.toLocaleString()} listings across all nine counties — built on open data, free
        for the community, and correctable by the owners themselves.
      </p>

      <form
        className="mt-5 flex flex-wrap gap-2"
        onSubmit={(ev) => {
          ev.preventDefault();
          patch({ q: qDraft || undefined });
        }}
      >
        <label className="sr-only" htmlFor="ld-search">
          Search the directory
        </label>
        <input
          id="ld-search"
          value={qDraft}
          onChange={(e) => setQDraft(e.target.value)}
          onBlur={() => patch({ q: qDraft || undefined })}
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
        {(activeCount > 0 || search.q) && (
          <button
            type="button"
            onClick={reset}
            className="min-h-11 rounded-sm border border-border px-4 text-sm font-semibold text-ink hover:border-primary"
          >
            Clear
          </button>
        )}
      </form>

      {/* Category rail: compact, horizontally scrollable on phones. */}
      <div className="mt-4 -mx-4 overflow-x-auto px-4">
        <div className="flex gap-2 pb-1">
          <Link
            to="/directory"
            search={(prev) => ({ ...prev, category: undefined, subcategory: undefined })}
            className={`min-h-9 shrink-0 rounded-full border px-3 text-xs font-semibold ${
              !search.category ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground"
            }`}
          >
            All
          </Link>
          {DIRECTORY_TAXONOMY.map((c) => (
            <Link
              key={c.key}
              to="/directory"
              search={(prev) => ({
                ...prev,
                category: search.category === c.key ? undefined : c.key,
                subcategory: undefined,
              })}
              className={`min-h-9 shrink-0 rounded-full border px-3 text-xs font-semibold ${
                search.category === c.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-foreground"
              }`}
            >
              {c.label}
              <span className="ml-1 font-normal text-muted-foreground">{countFor(c.key)}</span>
            </Link>
          ))}
        </div>
      </div>

      {showFilters && (
        <div className="mt-3 grid gap-3 rounded-sm border border-border bg-surface-tint p-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Subcategory
            <select
              value={search.subcategory ?? ""}
              onChange={(e) => patch({ subcategory: e.target.value || undefined })}
              disabled={!search.category}
              className="mt-1 min-h-10 w-full rounded-sm border border-border bg-background px-2 text-sm font-normal normal-case text-ink"
            >
              <option value="">All</option>
              {subcategoriesFor(search.category ?? "").map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            County
            <select
              value={search.county ?? ""}
              onChange={(e) => patch({ county: e.target.value || undefined, city: undefined })}
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
              value={search.city ?? ""}
              onChange={(e) => patch({ city: e.target.value || undefined })}
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
              value={search.community ?? ""}
              onChange={(e) => patch({ community: e.target.value || undefined })}
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
              checked={search.verified === true}
              onChange={(e) => patch({ verified: e.target.checked ? true : undefined })}
              className="size-4"
            />
            Owner-verified only
          </label>
        </div>
      )}

      <p className="mt-5 text-sm text-muted-foreground" aria-live="polite">
        {`${rows.length} listing${rows.length === 1 ? "" : "s"}`}
      </p>

      {results.error && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {results.error instanceof Error ? results.error.message : "Search failed."}
        </p>
      )}

      {categoryPending && (
        <p className="mt-3 rounded-sm border border-border bg-surface-tint px-3 py-2 text-sm text-muted-foreground">
          This category is being added — listings arrive automatically as our open-data import
          works through the nine counties.
        </p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((e) => (
          <article key={e.id} className="flex flex-col border border-border p-4">
            <h2 className="text-base font-bold text-ink">
              <Link
                to="/directory/$slug"
                params={{ slug: e.slug }}
                className="hover:text-primary hover:underline"
              >
                {e.name}
              </Link>
            </h2>
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
              <Link
                to="/directory/$slug"
                params={{ slug: e.slug }}
                className="text-primary hover:underline"
              >
                Details
              </Link>
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
            {/* ODbL requires the OpenStreetMap credit stored at ingest to stay visible. */}
            <p className="mt-2 text-[11px] text-muted-foreground">
              {e.verified_status ? "Owner verified · " : ""}
              {e.attribution ?? "Community listing"}
            </p>
          </article>
        ))}
      </div>

      {rows.length === 0 && !categoryPending && (
        <p className="mt-6 text-sm text-muted-foreground">
          Nothing here yet for this filter. Email{" "}
          <a href={`mailto:${COMMUNITY_EMAIL}`} className="font-semibold text-primary hover:underline">
            {COMMUNITY_EMAIL}
          </a>{" "}
          to add a listing.
        </p>
      )}

      <Suspense
        fallback={
          <p className="mt-12 border-t border-border pt-8 text-sm text-muted-foreground">
            Loading community organisations…
          </p>
        }
      >
        <CommunityOrgs />
      </Suspense>

      <CommunityAppeal what="business houses" />
    </div>
  );
}
