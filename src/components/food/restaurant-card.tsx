import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import {
  SOURCE_LABEL,
  isOpenNow,
  orderChoices,
  priceLabel,
  type RestaurantRating,
} from "@/lib/food";
import type { RestaurantSummary } from "@/lib/food.server";

const pill = "rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-ink";

export function RatingRow({
  ratings,
  community,
  ttScore,
  total,
}: {
  ratings: RestaurantRating[];
  community: { average: number | null; count: number };
  ttScore: number | null;
  total: number;
}) {
  const shown = ratings.filter((r) => r.rating != null);
  if (shown.length === 0 && community.average == null) {
    return (
      <p className="mt-1 text-[11px] text-muted-foreground">
        Ratings not yet collected — be the first to rate it.
      </p>
    );
  }
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
      {shown.map((r) => (
        <span key={r.source} className="whitespace-nowrap">
          <span className="font-semibold text-ink">{SOURCE_LABEL[r.source] ?? r.source}</span>{" "}
          {r.rating?.toFixed(1)} ★
          {r.review_count ? ` (${r.review_count.toLocaleString()})` : ""}
        </span>
      ))}
      {community.average != null && (
        <span className="whitespace-nowrap">
          <span className="font-semibold text-ink">TimesBayArea community</span>{" "}
          {community.average.toFixed(1)} ★ ({community.count})
        </span>
      )}
      {ttScore != null && (
        <span className="whitespace-nowrap rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
          TimesBayArea Score {ttScore.toFixed(1)}
        </span>
      )}
      {total > 0 && <span className="whitespace-nowrap">{total.toLocaleString()}+ reviews</span>}
    </div>
  );
}

/** Compact, mobile-first listing card: identity, ratings, then the actions. */
export function RestaurantCard({
  restaurant,
  distance,
}: {
  restaurant: RestaurantSummary;
  distance?: number | null;
}) {
  const open = isOpenNow(restaurant.hours);
  const order = orderChoices(restaurant);
  const price = priceLabel(restaurant.price_level);

  return (
    <article className="border-b border-border py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            to="/food/restaurant/$slug"
            params={{ slug: restaurant.slug }}
            className="text-[15px] font-bold leading-snug text-ink hover:text-primary"
          >
            {restaurant.name}
            {restaurant.branch_label ? ` — ${restaurant.branch_label}` : ""}
          </Link>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {[restaurant.cuisines.slice(0, 3).join(" • "), price].filter(Boolean).join(" • ")}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            📍 {restaurant.city ?? "Bay Area"}
            {distance != null ? ` • ${distance} miles` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {restaurant.sponsored && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
              Sponsored
            </span>
          )}
          {restaurant.verified && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
              Verified
            </span>
          )}
          {open != null && (
            <span
              className={`text-[11px] font-bold ${open ? "text-emerald-600" : "text-destructive"}`}
            >
              {open ? "Open now" : "Closed"}
            </span>
          )}
        </div>
      </div>

      <RatingRow
        ratings={restaurant.ratings}
        community={restaurant.community}
        ttScore={restaurant.tt_score}
        total={restaurant.review_total}
      />

      <div className="mt-2 flex flex-wrap gap-1.5">
        {restaurant.has_delivery && <span className={pill}>Delivery</span>}
        {restaurant.has_pickup && <span className={pill}>Pickup</span>}
        {restaurant.has_reservations && <span className={pill}>Reservations</span>}
        {restaurant.has_catering && <span className={pill}>Catering</span>}
        {restaurant.dietary.slice(0, 2).map((d) => (
          <span key={d} className={pill}>
            {d}
          </span>
        ))}
      </div>

      {restaurant.dish_tags.length > 0 && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          <Star className="mr-1 inline h-3 w-3" aria-hidden />
          {restaurant.dish_tags.slice(0, 4).join(", ")}
        </p>
      )}

      {order.length > 0 && (
        <p className="mt-2 flex flex-wrap gap-x-2 text-xs">
          <span className="font-semibold text-ink">Order:</span>
          {order.slice(0, 4).map((o) => (
            <a
              key={o.provider}
              href={o.url}
              target="_blank"
              rel="noopener nofollow"
              className="font-semibold text-primary underline"
            >
              {o.provider}
            </a>
          ))}
        </p>
      )}
    </article>
  );
}
