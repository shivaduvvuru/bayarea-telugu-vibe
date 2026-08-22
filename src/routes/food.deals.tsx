import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { fetchFoodDeals } from "@/lib/food.functions";
import { CUISINES, FOOD_CITIES } from "@/lib/food";

const TITLE = "Bay Area Restaurant Deals, Coupons & Lunch Specials | Times Bay Area";
const DESC =
  "Restaurant discounts, lunch specials, happy hours, catering promotions, delivery offers and Times Bay Area exclusive coupons across the Bay Area.";

export const Route = createFileRoute("/food/deals")({
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
  loader: () => fetchFoodDeals({ data: {} }),
  errorComponent: ({ error }) => (
    <p role="alert" className="mx-auto max-w-3xl px-4 py-10 text-sm text-destructive">
      {error.message}
    </p>
  ),
  notFoundComponent: () => <p className="mx-auto max-w-3xl px-4 py-10 text-sm">No deals yet.</p>,
  component: DealsPage,
});

const select = "min-h-10 rounded-md border border-border bg-card px-2 text-xs font-semibold text-ink";

function DealsPage() {
  const deals = Route.useLoaderData();
  const [city, setCity] = useState("");
  const [cuisine, setCuisine] = useState("");

  const shown = useMemo(
    () =>
      deals.filter(
        (d) => (!city || d.city === city) && (!cuisine || d.cuisine === cuisine),
      ),
    [deals, city, cuisine],
  );

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-5">
      <h1 className="text-lg font-extrabold text-ink">Food deals & coupons</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Lunch specials, happy hours, catering promotions, grand-opening offers and Times Bay Area
        exclusives.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <select className={select} value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">All cities</option>
          {FOOD_CITIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select className={select} value={cuisine} onChange={(e) => setCuisine(e.target.value)}>
          <option value="">All cuisines</option>
          {CUISINES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      <ul className="mt-4 divide-y divide-border">
        {shown.map((d) => (
          <li key={d.id} className="py-3">
            <p className="text-sm font-bold text-ink">
              {d.title}
              {d.sponsored && (
                <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                  Sponsored
                </span>
              )}
            </p>
            {d.description && <p className="mt-0.5 text-sm text-muted-foreground">{d.description}</p>}
            <p className="mt-0.5 text-xs text-muted-foreground">
              {[d.city, d.cuisine, d.deal_type].filter(Boolean).join(" • ")}
              {d.code ? ` • code ${d.code}` : ""}
            </p>
            {d.url && (
              <a
                href={d.url}
                target="_blank"
                rel="noopener nofollow"
                className="mt-1 inline-block text-sm font-semibold text-primary underline"
              >
                Get this deal
              </a>
            )}
          </li>
        ))}
      </ul>

      {shown.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">
          No deals listed yet. Restaurants can send offers through the Add / Claim form and our
          editors publish them here.
        </p>
      )}
    </div>
  );
}
