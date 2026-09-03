import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { fetchFoodCollections, fetchFoodDeals, fetchRestaurants } from "@/lib/food.functions";
import { QUICK_TILES, isOpenNow } from "@/lib/food";
import { RestaurantCard } from "@/components/food/restaurant-card";
import type { RestaurantSummary } from "@/lib/food.server";

const TITLE = "Bay Area Restaurants, Delivery & Food Deals | Times Bay Area";
const DESC =
  "Find Bay Area restaurants by cuisine, dish or city — biryani, dosa, pizza, sushi, tacos and more — with ratings, delivery and pickup links, reservations, catering and community favorites.";

export const Route = createFileRoute("/food/")({
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
  loader: async () => {
    const [restaurants, collections, deals] = await Promise.all([
      fetchRestaurants({ data: { limit: 300 } }),
      fetchFoodCollections(),
      fetchFoodDeals({ data: {} }),
    ]);
    return { restaurants, collections, deals };
  },
  errorComponent: ({ error }) => (
    <p role="alert" className="mx-auto max-w-3xl px-4 py-10 text-sm text-destructive">
      {error.message}
    </p>
  ),
  notFoundComponent: () => (
    <p className="mx-auto max-w-3xl px-4 py-10 text-sm">Nothing here yet.</p>
  ),
  component: FoodHome,
});

const tile =
  "min-h-10 rounded-full border border-border bg-card px-3 text-sm font-semibold text-ink hover:border-primary hover:text-primary";

function Row({
  title, subtitle, items, to,
}: {
  title: string;
  subtitle?: string;
  items: RestaurantSummary[];
  to?: { cuisine?: string; dish?: string; city?: string; service?: string };
}) {
  if (items.length === 0) return null;
  return (
    <section className="mt-6">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-ink">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <Link
          to="/food/restaurants"
          search={to ?? {}}
          className="shrink-0 text-xs font-semibold text-primary"
        >
          See all
        </Link>
      </div>
      <div className="mt-1">
        {items.slice(0, 4).map((r) => (
          <RestaurantCard key={r.id} restaurant={r} />
        ))}
      </div>
    </section>
  );
}

function FoodHome() {
  const { restaurants, collections, deals } = Route.useLoaderData();
  const navigate = useNavigate();
  const [term, setTerm] = useState("");

  const has = (r: RestaurantSummary, list: string[], want: string) =>
    list.some((v) => v.toLowerCase().includes(want.toLowerCase()));

  const sets = useMemo(() => {
    const byScore = [...restaurants].sort((a, b) => (b.tt_score ?? 0) - (a.tt_score ?? 0));
    const openNow = restaurants.filter((r) => isOpenNow(r.hours) === true);
    return {
      popular: byScore.slice(0, 6),
      bestRated: byScore.filter((r) => (r.tt_score ?? 0) > 0).slice(0, 6),
      trending: [...restaurants].sort((a, b) => b.review_total - a.review_total).slice(0, 6),
      fresh: [...restaurants]
        .sort((a, b) => (b.opened_at ?? b.created_at).localeCompare(a.opened_at ?? a.created_at))
        .slice(0, 6),
      indian: restaurants.filter((r) => has(r, r.cuisines, "Indian")).slice(0, 6),
      biryani: restaurants.filter((r) => has(r, r.dish_tags, "Biryani")).slice(0, 6),
      tiffins: restaurants.filter(
        (r) => has(r, r.dish_tags, "Dosa") || has(r, r.restaurant_types, "Tiffins"),
      ),
      telugu: restaurants.filter(
        (r) => has(r, r.cuisines, "Telugu") || has(r, r.cuisines, "Andhra") || has(r, r.cuisines, "Telangana"),
      ),
      family: restaurants.filter((r) => has(r, r.features, "Family")),
      brunch: restaurants.filter(
        (r) => has(r, r.cuisines, "Brunch") || has(r, r.restaurant_types, "Brunch"),
      ),
      lateNight: restaurants.filter(
        (r) => has(r, r.features, "Late Night") || has(r, r.restaurant_types, "Late Night"),
      ),
      delivery: restaurants.filter((r) => r.has_delivery),
      catering: restaurants.filter((r) => r.has_catering),
      openNow,
    };
  }, [restaurants]);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-5">
      <h1 className="text-xl font-extrabold leading-tight text-ink">
        What do you want to eat today?
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Search restaurants, cuisines, dishes or a Bay Area city.
      </p>

      <form
        className="mt-3 flex items-center gap-2 rounded-full border border-border bg-card px-3"
        onSubmit={(e) => {
          e.preventDefault();
          void navigate({ to: "/food/restaurants", search: { q: term.trim() } });
        }}
      >
        <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Biryani, dosa, sushi, Fremont…"
          aria-label="Search restaurants, cuisines, dishes or cities"
          className="min-h-11 w-full bg-transparent text-sm text-ink outline-none"
        />
        <button type="submit" className="text-sm font-semibold text-primary">
          Search
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK_TILES.map((t) => (
          <Link key={t.label} to="/food/restaurants" search={t.search} className={`${tile} inline-flex items-center`}>
            {t.label}
          </Link>
        ))}
      </div>

      {deals.length > 0 && (
        <section className="mt-6 rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-ink">Restaurant deals</h2>
            <Link to="/food/deals" className="text-xs font-semibold text-primary">
              All deals
            </Link>
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {deals.slice(0, 3).map((d) => (
              <li key={d.id} className="text-ink">
                <span className="font-semibold">{d.title}</span>
                {d.city ? <span className="text-muted-foreground"> — {d.city}</span> : null}
                {d.sponsored && (
                  <span className="ml-1 text-[10px] font-bold uppercase text-amber-700">Sponsored</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Row title="Popular near you" subtitle="Highest TimesBayArea scores across the Bay" items={sets.popular} />
      <Row title="Open now" items={sets.openNow} to={{ service: "delivery" }} />
      <Row title="Best rated" items={sets.bestRated} />
      <Row title="Trending restaurants" items={sets.trending} />
      <Row title="New restaurants" items={sets.fresh} />
      <Row title="Best Indian restaurants" items={sets.indian} to={{ cuisine: "Indian" }} />
      <Row title="Best biryani" items={sets.biryani} to={{ dish: "Biryani" }} />
      <Row title="Best dosa & tiffins" items={sets.tiffins} to={{ dish: "Dosa" }} />
      <Row title="Indian community favorites" items={sets.telugu} to={{ cuisine: "Telugu" }} />
      <Row title="Family dining" items={sets.family} />
      <Row title="Weekend brunch" items={sets.brunch} to={{ cuisine: "Brunch" }} />
      <Row title="Late night food" items={sets.lateNight} />
      <Row title="Delivery near you" items={sets.delivery} to={{ service: "delivery" }} />
      <Row title="Featured catering" items={sets.catering} to={{ service: "catering" }} />

      {collections.length > 0 && (
        <section className="mt-8">
          <h2 className="text-base font-bold text-ink">Editor collections</h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {collections.map((c) => (
              <li key={c.id}>
                <Link
                  to="/food/collection/$slug"
                  params={{ slug: c.slug }}
                  className="block rounded-lg border border-border bg-card p-3 hover:border-primary"
                >
                  <span className="text-sm font-bold text-ink">{c.title}</span>
                  {c.description && (
                    <span className="mt-0.5 block text-xs text-muted-foreground">{c.description}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 text-xs text-muted-foreground">
        Own a restaurant?{" "}
        <Link to="/food/add" className="font-semibold text-primary">
          Add or claim your listing
        </Link>{" "}
        — free, reviewed by our editors before it goes live.
      </p>
    </div>
  );
}
