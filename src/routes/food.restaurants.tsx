import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { MapPin, Search } from "lucide-react";
import { fetchRestaurants } from "@/lib/food.functions";
import {
  CUISINES,
  DIETARY,
  FEATURES,
  FOOD_CITIES,
  RESTAURANT_TYPES,
  SORTS,
  coordsFor,
  driveTimeLabel,
  mapEmbedUrl,
  isOpenNow,
  milesBetween,
} from "@/lib/food";
import { RestaurantCard } from "@/components/food/restaurant-card";
import type { RestaurantSummary } from "@/lib/food.server";

const TITLE = "Bay Area Restaurant Directory — All Cuisines | Times Bay Area";
const DESC =
  "Filter Bay Area restaurants by cuisine, dish, city, distance, rating, price, diet, delivery, pickup, reservations and catering.";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  city: fallback(z.string(), "").default(""),
  cuisine: fallback(z.string(), "").default(""),
  dish: fallback(z.string(), "").default(""),
  type: fallback(z.string(), "").default(""),
  diet: fallback(z.string(), "").default(""),
  feature: fallback(z.string(), "").default(""),
  service: fallback(z.string(), "").default(""),
  minRating: fallback(z.number(), 0).default(0),
  maxPrice: fallback(z.number(), 0).default(0),
  open: fallback(z.number(), 0).default(0),
  near: fallback(z.number(), 0).default(0),
  sort: fallback(z.string(), "recommended").default("recommended"),
});

export const Route = createFileRoute("/food/restaurants")({
  validateSearch: zodValidator(searchSchema),
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
  loader: () => fetchRestaurants({ data: { limit: 400 } }),
  errorComponent: ({ error }) => (
    <p role="alert" className="mx-auto max-w-3xl px-4 py-10 text-sm text-destructive">
      {error.message}
    </p>
  ),
  notFoundComponent: () => (
    <p className="mx-auto max-w-3xl px-4 py-10 text-sm">No restaurants yet.</p>
  ),
  component: RestaurantList,
});

const chip = (active: boolean) =>
  `min-h-9 shrink-0 rounded-full border px-3 text-xs font-semibold ${
    active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-ink"
  }`;

const select =
  "min-h-10 rounded-md border border-border bg-card px-2 text-xs font-semibold text-ink";

function matches(values: string[], want: string) {
  return !want || values.some((v) => v.toLowerCase() === want.toLowerCase());
}

function RestaurantList() {
  const all = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/food/restaurants" });
  const [term, setTerm] = useState(search.q);
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">("list");

  const set = (patch: Partial<typeof search>) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch }) });

  useEffect(() => setTerm(search.q), [search.q]);

  useEffect(() => {
    if (!search.near || here || typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoError("We could not read your location — pick a city instead."),
      { timeout: 8000 },
    );
  }, [search.near, here]);

  const results = useMemo(() => {
    const term2 = search.q.trim().toLowerCase();
    const withDistance = all.map((r) => {
      const c = coordsFor(r);
      return {
        r,
        distance: here && c ? milesBetween(here, c) : null,
      };
    });

    const filtered = withDistance.filter(({ r, distance }) => {
      if (search.city && r.city !== search.city) return false;
      if (!matches(r.cuisines, search.cuisine)) return false;
      if (!matches(r.dish_tags, search.dish)) return false;
      if (!matches(r.restaurant_types, search.type)) return false;
      if (!matches(r.dietary, search.diet)) return false;
      if (!matches(r.features, search.feature)) return false;
      if (search.service === "delivery" && !r.has_delivery) return false;
      if (search.service === "pickup" && !r.has_pickup) return false;
      if (search.service === "dine-in" && !r.has_dine_in) return false;
      if (search.service === "reservations" && !r.has_reservations) return false;
      if (search.service === "catering" && !r.has_catering) return false;
      if (search.maxPrice && (r.price_level ?? 9) > search.maxPrice) return false;
      if (search.minRating && (r.tt_score ?? 0) < search.minRating) return false;
      if (search.open && isOpenNow(r.hours) !== true) return false;
      if (search.near && distance != null && distance > 25) return false;
      if (term2) {
        const hay = [
          r.name,
          r.city ?? "",
          r.description ?? "",
          ...r.cuisines,
          ...r.dish_tags,
          ...r.restaurant_types,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(term2)) return false;
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (search.sort) {
        case "nearest":
          return (a.distance ?? 999) - (b.distance ?? 999);
        case "rating":
        case "tt":
          return (b.r.tt_score ?? 0) - (a.r.tt_score ?? 0);
        case "reviews":
          return b.r.review_total - a.r.review_total;
        case "price_asc":
          return (a.r.price_level ?? 9) - (b.r.price_level ?? 9);
        case "newest":
          return (b.r.opened_at ?? b.r.created_at).localeCompare(a.r.opened_at ?? a.r.created_at);
        default:
          // Recommended: sponsored and verified first, then score, then name.
          return (
            Number(b.r.sponsored) - Number(a.r.sponsored) ||
            Number(b.r.verified) - Number(a.r.verified) ||
            (b.r.tt_score ?? 0) - (a.r.tt_score ?? 0) ||
            a.r.name.localeCompare(b.r.name)
          );
      }
    });
    return sorted;
  }, [all, here, search]);

  // Centre the map on where the results actually are: the user's location,
  // the first result's coordinates, or a text search for the chosen city.
  const mapSrc = (() => {
    if (here) return mapEmbedUrl(here, 12);
    const first = results.map(({ r }) => coordsFor(r)).find(Boolean);
    if (first) return mapEmbedUrl(first, 12);
    return mapEmbedUrl(
      `${search.cuisine || search.dish || "restaurants"} in ${search.city || "Bay Area"} California`,
      11,
    );
  })();

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-5">
      <h1 className="text-lg font-extrabold text-ink">Bay Area restaurants</h1>

      <form
        className="mt-3 flex items-center gap-2 rounded-full border border-border bg-card px-3"
        onSubmit={(e) => {
          e.preventDefault();
          set({ q: term.trim() });
        }}
      >
        <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Restaurant, cuisine, dish or city"
          aria-label="Search restaurants"
          className="min-h-11 w-full bg-transparent text-sm text-ink outline-none"
        />
        <button type="submit" className="text-sm font-semibold text-primary">
          Go
        </button>
      </form>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        <button type="button" onClick={() => set({ near: search.near ? 0 : 1 })} className={chip(!!search.near)}>
          <MapPin className="mr-1 inline h-3 w-3" aria-hidden /> Near me
        </button>
        <button type="button" onClick={() => set({ open: search.open ? 0 : 1 })} className={chip(!!search.open)}>
          Open now
        </button>
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
          className={chip(showFilters || activeCount > 0)}
        >
          <SlidersHorizontal className="mr-1 inline h-3 w-3" aria-hidden />
          Filters{activeCount ? ` (${activeCount})` : ""}
        </button>
        <button type="button" onClick={() => setView(view === "list" ? "map" : "list")} className={chip(view === "map")}>
          {view === "list" ? "Map" : "List"}
        </button>
        {activeChips.length > 0 && !showFilters && (
          <>
            {activeChips.map((c) => (
              <button key={c.label} type="button" onClick={c.clear} className={chip(true)}>
                {c.label} <X className="ml-1 inline h-3 w-3" aria-hidden />
              </button>
            ))}
          </>
        )}
      </div>

      {showFilters && (
        <div className="mt-2 rounded-xl border border-border bg-card p-3">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {(["delivery", "pickup", "dine-in", "reservations", "catering"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => set({ service: search.service === s ? "" : s })}
                className={chip(search.service === s)}
              >
                {s === "dine-in" ? "Dine-in" : s[0]!.toUpperCase() + s.slice(1)}
              </button>
            ))}
            {DIETARY.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => set({ diet: search.diet === d ? "" : d })}
                className={chip(search.diet === d)}
              >
                {d}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <select className={select} value={search.city} onChange={(e) => set({ city: e.target.value })}>
              <option value="">All cities</option>
              {FOOD_CITIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select className={select} value={search.cuisine} onChange={(e) => set({ cuisine: e.target.value })}>
              <option value="">All cuisines</option>
              {CUISINES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select className={select} value={search.type} onChange={(e) => set({ type: e.target.value })}>
              <option value="">All types</option>
              {RESTAURANT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <select className={select} value={search.feature} onChange={(e) => set({ feature: e.target.value })}>
              <option value="">Any features</option>
              {FEATURES.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
            <select
              className={select}
              value={String(search.minRating)}
              onChange={(e) => set({ minRating: Number(e.target.value) })}
            >
              <option value="0">Any rating</option>
              <option value="4">4.0+ score</option>
              <option value="4.5">4.5+ score</option>
            </select>
            <select
              className={select}
              value={String(search.maxPrice)}
              onChange={(e) => set({ maxPrice: Number(e.target.value) })}
            >
              <option value="0">Any price</option>
              <option value="1">$</option>
              <option value="2">$$ and under</option>
              <option value="3">$$$ and under</option>
            </select>
            <select className={select} value={search.sort} onChange={(e) => set({ sort: e.target.value })}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={select}
              onClick={() =>
                set({
                  city: "",
                  cuisine: "",
                  type: "",
                  feature: "",
                  diet: "",
                  service: "",
                  minRating: 0,
                  maxPrice: 0,
                  sort: "recommended",
                })
              }
            >
              Clear all
            </button>
          </div>
        </div>
      )}


      {geoError && <p className="mt-2 text-xs text-destructive">{geoError}</p>}

      <p className="mt-3 text-xs text-muted-foreground">
        {results.length} restaurant{results.length === 1 ? "" : "s"}
        {search.near && !here ? " • waiting for your location" : ""}
      </p>

      {view === "map" ? (
        <div className="mt-3">
          <iframe
            title="Restaurant map"
            className="h-80 w-full rounded-lg border border-border"
            loading="lazy"
            src={mapSrc}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Tap a restaurant to open its own map and drive time.
          </p>
          <ul className="mt-1 divide-y divide-border">
            {results.slice(0, 30).map(({ r, distance }) => (
              <li key={r.id} className="py-2">
                <Link
                  to="/food/restaurant/$slug"
                  params={{ slug: r.slug }}
                  className="text-sm font-semibold text-ink hover:text-primary"
                >
                  {r.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {[
                    r.city ?? "Bay Area",
                    distance != null ? `${distance} miles` : null,
                    driveTimeLabel(distance),
                  ]
                    .filter(Boolean)
                    .join(" • ")}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : (

        <div className="mt-2">
          {results.map(({ r, distance }: { r: RestaurantSummary; distance: number | null }) => (
            <RestaurantCard key={r.id} restaurant={r} distance={distance} />
          ))}
          {results.length === 0 && (
            <p className="py-8 text-sm text-muted-foreground">
              Nothing matched. Try clearing a filter or widening the city.
            </p>
          )}
        </div>
      )}
      <p className="mt-6 border-t border-border pt-3 text-[11px] leading-snug text-muted-foreground">
        Listing data © OpenStreetMap contributors, available under the Open Database Licence (ODbL).
        Ratings shown as “TimesBayArea” come from our own readers.
      </p>
    </div>
  );
}
