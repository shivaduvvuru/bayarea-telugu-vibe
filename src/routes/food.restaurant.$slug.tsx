import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Clock, MapPin, Phone, Share2 } from "lucide-react";
import { fetchRestaurant } from "@/lib/food.functions";
import {
  directionsUrl,
  isOpenNow,
  orderChoices,
  priceLabel,
  reservationUrl,
  reviewLinks,
} from "@/lib/food";
import { RatingRow } from "@/components/food/restaurant-card";
import { ReviewPanel } from "@/components/food/review-panel";

export const Route = createFileRoute("/food/restaurant/$slug")({
  loader: async ({ params }) => {
    const detail = await fetchRestaurant({ data: { slug: params.slug } });
    if (!detail) throw notFound();
    return detail;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Restaurant unavailable" }, { name: "robots", content: "noindex" }] };
    }
    const r = loaderData.restaurant;
    const title = `${r.name}${r.city ? ` — ${r.city}` : ""} | Times Bay Area Food`;
    const desc =
      r.description ??
      `${r.name} in ${r.city ?? "the Bay Area"}: ${r.cuisines.join(", ")}. Hours, ratings, delivery, pickup, reservations and catering.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc.slice(0, 155) },
        { property: "og:title", content: title },
        { property: "og:description", content: desc.slice(0, 155) },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  errorComponent: ({ error }) => (
    <p role="alert" className="mx-auto max-w-3xl px-4 py-10 text-sm text-destructive">
      {error.message}
    </p>
  ),
  notFoundComponent: NotFoundRestaurant,
  component: RestaurantDetailPage;
});

function NotFoundRestaurant() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-lg font-bold text-ink">We could not find that restaurant</h1>
      <Link to="/food/restaurants" className="mt-2 inline-block text-sm font-semibold text-primary">
        Browse all restaurants
      </Link>
    </div>
  );
}

const action =
  "min-h-11 flex-1 rounded-md border border-border bg-card px-3 text-center text-sm font-semibold leading-[2.75rem] text-ink hover:border-primary";

function RestaurantDetailPage() {
  const { restaurant: r, reviews, deals } = Route.useLoaderData();
  const open = isOpenNow(r.hours);
  const order = orderChoices(r);

  function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      void navigator.share({ title: r.name, url });
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(url);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-5">
      <h1 className="text-xl font-extrabold leading-tight text-ink">
        {r.name}
        {r.branch_label ? ` — ${r.branch_label}` : ""}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {[r.cuisines.join(" • "), priceLabel(r.price_level)].filter(Boolean).join(" • ")}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
        {r.verified && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-bold uppercase text-primary">
            Verified restaurant
          </span>
        )}
        {r.sponsored && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-bold uppercase text-amber-700">
            Sponsored
          </span>
        )}
        {open != null && (
          <span className={`font-bold ${open ? "text-emerald-600" : "text-destructive"}`}>
            {open ? "Open now" : "Closed now"}
          </span>
        )}
      </div>

      {r.photos.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {r.photos.slice(0, 6).map((p) => (
            <img
              key={p}
              src={p}
              alt={`${r.name} food and interior`}
              loading="lazy"
              className="h-40 w-60 shrink-0 rounded-lg object-cover"
            />
          ))}
        </div>
      )}

      {r.description && <p className="mt-3 text-sm text-ink">{r.description}</p>}

      <RatingRow
        ratings={r.ratings}
        community={r.community}
        ttScore={r.tt_score}
        total={r.review_total}
      />
      {r.tt_score != null && (
        <details className="mt-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-semibold text-ink">
            How the TimesBayArea Score is calculated
          </summary>
          <p className="mt-1">
            A calculated score — not a platform rating. It blends the sources listed above, weighted
            by how many reviews each carries, how reliable and how recent the source is, and damped
            so a handful of reviews cannot swing it.
          </p>
          <ul className="mt-1 list-disc pl-4">
            {r.ratings
              .filter((x) => x.rating != null)
              .map((x) => (
                <li key={x.source}>
                  {x.source}: {x.rating} ({x.review_count ?? 0} reviews)
                </li>
              ))}
            {r.community.average != null && (
              <li>
                TimesBayArea community: {r.community.average} ({r.community.count} reviews)
              </li>
            )}
          </ul>
        </details>
      )}

      {order.length > 0 && (
        <section className="mt-4 rounded-lg border border-primary/40 bg-primary/5 p-3">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-primary">Order now</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {[r.has_delivery && "Delivery", r.has_pickup && "Pickup"].filter(Boolean).join(" • ")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {order.map((o) => (
              <a
                key={o.provider}
                href={o.url}
                target="_blank"
                rel="noopener nofollow"
                className="min-h-11 rounded-md bg-primary px-3 text-sm font-semibold leading-[2.75rem] text-primary-foreground"
              >
                {o.provider}
              </a>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Delivery fees, minimums and estimated times are shown by the provider at checkout.
          </p>
        </section>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {r.menu_url && (
          <a href={r.menu_url} target="_blank" rel="noopener" className={action}>
            View menu
          </a>
        )}
        {(r.has_reservations || r.reservation_url) && (
          <a href={reservationUrl(r)} target="_blank" rel="noopener nofollow" className={action}>
            Reserve table
          </a>
        )}
        {r.phone && (
          <a href={`tel:${r.phone}`} className={action}>
            Call
          </a>
        )}
        <a href={directionsUrl(r)} target="_blank" rel="noopener" className={action}>
          Directions
        </a>
        <button type="button" onClick={share} className={action}>
          <Share2 className="mr-1 inline h-4 w-4" aria-hidden /> Share
        </button>
      </div>

      <dl className="mt-4 space-y-1.5 text-sm">
        {r.address && (
          <div className="flex gap-2">
            <dt className="sr-only">Address</dt>
            <dd className="text-ink">
              <MapPin className="mr-1 inline h-4 w-4 text-muted-foreground" aria-hidden />
              {r.address}
            </dd>
          </div>
        )}
        {!r.address && r.city && (
          <div>
            <dt className="sr-only">City</dt>
            <dd className="text-ink">
              <MapPin className="mr-1 inline h-4 w-4 text-muted-foreground" aria-hidden />
              {r.city} — full address pending owner confirmation
            </dd>
          </div>
        )}
        {(r.hours_text || r.hours) && (
          <div>
            <dt className="sr-only">Hours</dt>
            <dd className="text-ink">
              <Clock className="mr-1 inline h-4 w-4 text-muted-foreground" aria-hidden />
              {r.hours_text ?? "See hours below"}
            </dd>
          </div>
        )}
        {r.phone && (
          <div>
            <dt className="sr-only">Phone</dt>
            <dd className="text-ink">
              <Phone className="mr-1 inline h-4 w-4 text-muted-foreground" aria-hidden />
              {r.phone}
            </dd>
          </div>
        )}
        {r.website_url && (
          <div>
            <dt className="sr-only">Website</dt>
            <dd>
              <a href={r.website_url} target="_blank" rel="noopener" className="text-primary underline">
                Restaurant website
              </a>
            </dd>
          </div>
        )}
      </dl>

      {r.hours && Object.keys(r.hours).length > 0 && (
        <table className="mt-3 w-full max-w-xs text-xs">
          <caption className="sr-only">Opening hours</caption>
          <tbody>
            {Object.entries(r.hours).map(([day, window]) => (
              <tr key={day} className="border-b border-border/60">
                <th scope="row" className="py-1 text-left font-semibold capitalize text-ink">
                  {day}
                </th>
                <td className="py-1 text-right text-muted-foreground">
                  {window === "closed" ? "Closed" : window}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
        {[
          r.has_dine_in && "Dine-in",
          r.has_pickup && "Takeout / pickup",
          r.has_delivery && "Delivery",
          r.has_reservations && "Reservations",
          r.has_catering && "Catering",
          ...r.dietary,
          ...r.features,
        ]
          .filter(Boolean)
          .map((f) => (
            <span key={String(f)} className="rounded-full border border-border px-2 py-0.5 font-semibold text-ink">
              {f}
            </span>
          ))}
      </div>

      {r.dish_tags.length > 0 && (
        <p className="mt-3 text-sm text-ink">
          <span className="font-bold">Popular dishes:</span> {r.dish_tags.join(", ")}
        </p>
      )}

      {deals.length > 0 && (
        <section className="mt-5">
          <h2 className="text-base font-bold text-ink">Current deals</h2>
          <ul className="mt-1 space-y-1 text-sm">
            {deals.map((d) => (
              <li key={d.id} className="text-ink">
                <span className="font-semibold">{d.title}</span>
                {d.code ? <span className="text-muted-foreground"> — code {d.code}</span> : null}
                {d.url && (
                  <a href={d.url} target="_blank" rel="noopener nofollow" className="ml-2 text-primary underline">
                    Redeem
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-5">
        <h2 className="text-base font-bold text-ink">Read full reviews</h2>
        <ul className="mt-1 space-y-1 text-sm">
          {reviewLinks(r).map((l) => (
            <li key={l.url}>
              <a href={l.url} target="_blank" rel="noopener nofollow" className="text-primary underline">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Each platform's rating is its own — we never merge them into a single star count.
        </p>
      </section>

      <ReviewPanel restaurantId={r.id} restaurantName={r.name} reviews={reviews} />

      <p className="mt-8 text-xs text-muted-foreground">
        Something wrong here?{" "}
        <Link to="/food/add" search={{ claim: r.slug }} className="font-semibold text-primary">
          Claim this restaurant or report a correction
        </Link>
        .
      </p>
    </div>
  );
}
