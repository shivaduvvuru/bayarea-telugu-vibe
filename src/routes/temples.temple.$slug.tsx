import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, queryOptions } from "@tanstack/react-query";
import { listTempleEvents } from "@/lib/temple-calendar.functions";
import { formatEventDay, formatEventTime } from "@/lib/temple-calendar";

import { BadgeCheck, MapPin, Navigation, Globe, Phone, Clock } from "lucide-react";
import {
  templeBySlug,
  templesInCity,
  directionsUrl,
  mapsUrl,
  CITY_SLUGS,
} from "@/lib/temple-directory";
import { listTempleAnnouncements } from "@/lib/temples.functions";
import { TempleCard } from "@/components/temple-card";
import { COMMUNITY_EMAIL } from "@/lib/community-data";

const announcementsQuery = queryOptions({
  queryKey: ["temples", "announcements"],
  queryFn: () => listTempleAnnouncements(),
  staleTime: 30 * 60 * 1000,
});

export const Route = createFileRoute("/temples/temple/$slug")({
  loader: async ({ params, context }) => {
    const temple = templeBySlug(params.slug);
    if (!temple) throw notFound();
    await context.queryClient.ensureQueryData(announcementsQuery);
    return { temple };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Temple not found" }, { name: "robots", content: "noindex" }] };
    }
    const t = loaderData.temple;
    const place = t.city ?? t.nearby_city ?? t.region;
    const title = `${t.name}, ${place} — Bay Area Temple Directory | Telugu Times`;
    const desc = `${t.name} in ${place}: address, directions, website${
      t.deities.length ? `, deities (${t.deities.join(", ")})` : ""
    } and upcoming events.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  notFoundComponent: TempleNotFound,
  errorComponent: TempleNotFound,
  component: TempleDetailPage,
});

function TempleNotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-ink">Temple not found</h1>
      <Link to="/temples" className="mt-4 inline-block font-semibold text-primary">
        Back to the temple directory
      </Link>
    </div>
  );
}

function domainOf(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] ?? "";
}

function TempleDetailPage() {
  const { temple: t } = Route.useLoaderData();
  const { data: groups } = useSuspenseQuery(announcementsQuery);
  const announcements =
    groups.find((g) => domainOf(g.site) === domainOf(t.website))?.announcements ?? [];
  const nearby = (t.city ? templesInCity(t.city) : []).filter((o) => o.slug !== t.slug).slice(0, 3);
  const citySlug = CITY_SLUGS.find((c) => c.en === (t.city ?? t.nearby_city))?.slug;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "PlaceOfWorship",
            name: t.name,
            alternateName: t.alternate_names,
            address: t.address,
            url: t.website,
            telephone: t.phone ?? undefined,
          }),
        }}
      />
      <nav className="text-xs text-muted-foreground" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-primary">
          Home
        </Link>{" "}
        ›{" "}
        <Link to="/temples" className="hover:text-primary">
          Temples
        </Link>
        {citySlug && (
          <>
            {" "}
            ›{" "}
            <Link to="/temples/$city" params={{ city: citySlug }} className="hover:text-primary">
              {t.city ?? t.nearby_city}
            </Link>
          </>
        )}
      </nav>

      <h1 className="mt-2 text-2xl font-bold leading-tight text-ink md:text-3xl">{t.name}</h1>
      {t.alternate_names.length > 0 && (
        <p className="mt-1 text-sm text-muted-foreground">
          Also known as {t.alternate_names.join(", ")}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <span>
          {t.city ?? `Near ${t.nearby_city}`} · {t.region}
        </span>
        {t.verified && (
          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 font-bold text-primary">
            <BadgeCheck className="h-3.5 w-3.5" /> Verified {t.last_verified_at}
          </span>
        )}
      </div>

      <p className="mt-4 flex items-start gap-2 text-[15px] text-ink">
        <MapPin className="mt-1 h-4 w-4 shrink-0 text-primary" />
        <a href={mapsUrl(t.address)} target="_blank" rel="noopener noreferrer">
          {t.address}
        </a>
      </p>
      {t.opening_hours && (
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" /> {t.opening_hours}
        </p>
      )}
      {t.description && <p className="mt-4 text-[15px] leading-relaxed text-ink">{t.description}</p>}

      {(t.deities.length > 0 || t.traditions.length > 0) && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {[t.temple_type, ...t.deities, ...t.traditions].map((tag) => (
            <li
              key={tag}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
            >
              {tag}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <a
          href={directionsUrl(t.address)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center justify-center gap-2 rounded-sm bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          <Navigation className="h-4 w-4" /> Directions
        </a>
        <a
          href={t.website}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center justify-center gap-2 rounded-sm border border-border px-4 text-sm font-semibold text-ink"
        >
          <Globe className="h-4 w-4" /> Temple website
        </a>
        {t.phone && (
          <a
            href={`tel:${t.phone.replace(/\s/g, "")}`}
            className="flex min-h-11 items-center justify-center gap-2 rounded-sm border border-border px-4 text-sm font-semibold text-ink"
          >
            <Phone className="h-4 w-4" /> Call
          </a>
        )}
      </div>

      {t.other_locations.length > 0 && (
        <section className="mt-8">
          <h2 className="text-base font-bold text-ink">Other locations</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {t.other_locations.map((o: { label: string; address?: string }) => (
              <li key={o.label}>
                <span className="font-semibold text-ink">{o.label}</span>
                {o.address ? ` — ${o.address}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      <TempleUpcomingPrograms slug={t.slug} />

      <section className="mt-8">

        <h2 className="border-b-2 border-primary pb-2 text-lg font-bold text-ink">
          Upcoming & recent announcements
        </h2>
        {announcements.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No announcements published on the temple site right now. Check the temple website for
            the latest calendar.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {announcements.slice(0, 10).map((a) => (
              <li key={a.title} className="text-[15px] leading-snug">
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center font-semibold headline-link"
                >
                  {a.title}
                </a>
                {a.date && <span className="text-xs text-muted-foreground">{a.date}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {nearby.length > 0 && (
        <section className="mt-8">
          <h2 className="text-base font-bold text-ink">More temples in {t.city}</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {nearby.map((o) => (
              <TempleCard key={o.id} temple={o} />
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 border border-border bg-surface-tint p-5">
        <h2 className="text-base font-bold text-ink">Is this your temple?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Claim this listing to update hours, contacts and events, or report an error.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to="/submit"
            className="flex min-h-11 items-center rounded-sm bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            Claim / suggest an update
          </Link>
          <a
            href={`mailto:${COMMUNITY_EMAIL}?subject=${encodeURIComponent(`Temple listing: ${t.name}`)}`}
            className="flex min-h-11 items-center rounded-sm border border-border px-5 text-sm font-semibold text-ink"
          >
            Report an error
          </a>
        </div>
      </div>
    </div>
  );
}

/** Next few programs for this temple, read from the master Temple Calendar. */
function TempleUpcomingPrograms({ slug }: { slug: string }) {
  const { data: events = [] } = useQuery({
    queryKey: ["temple-events", "temple", slug],
    queryFn: () => listTempleEvents({ data: { templeSlug: slug, limit: 10 } }),
    staleTime: 30 * 60 * 1000,
  });
  if (events.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="border-b-2 border-primary pb-2 text-lg font-bold text-ink">
        Upcoming programs at this temple
      </h2>
      <ul className="mt-3 divide-y divide-border rounded-sm border border-border bg-card">
        {events.slice(0, 5).map((e) => {
          const day = formatEventDay(e.startsAt);
          return (
            <li key={e.id} className="flex items-start gap-3 p-3">
              <div className="w-14 flex-none rounded-md bg-primary/10 px-2 py-1 text-center">
                <p className="text-[10px] font-bold tracking-wide text-primary">{day.dow}</p>
                <p className="text-xs font-semibold text-ink">{day.date}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold leading-snug text-ink">{e.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[e.eventType, formatEventTime(e.startsAt, e.allDay), ...e.deities]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <Link
        to="/temples/calendar"
        className="mt-3 inline-block text-sm font-semibold text-primary"
      >
        View full Temple Calendar →
      </Link>
    </section>
  );
}

