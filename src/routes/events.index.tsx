import { createFileRoute, Link } from "@tanstack/react-router";
import { EVENTS, upcomingEvents, weekendEvents } from "@/lib/news-data";
import { EventCard } from "@/components/events";
import { SectionHeading } from "@/components/news";
import { useLang } from "@/lib/language";
import { EventFilterBar, useEventFilter } from "@/components/event-filters";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { listCommunityItems } from "@/lib/cms.functions";
import { listPosts } from "@/lib/content.functions";
import { formatDate } from "@/lib/content";
import { classifyIndia } from "@/lib/india-topics";
import { isBayArea, isBayAreaSource } from "@/lib/bay-area";
import { listTempleEvents } from "@/lib/temple-calendar.functions";
import { formatEventDay, formatEventTime } from "@/lib/temple-calendar";

/** Events published by the newsroom desk (collected city guides + submissions). */
const liveEventsQuery = queryOptions({
  queryKey: ["cms", "events", "page", "wide"],
  queryFn: () => listCommunityItems({ data: { kind: "event", limit: 200 } }),
  staleTime: 5 * 60 * 1000,
});

const eventPostsQuery = queryOptions({
  queryKey: ["wp", "posts", "events-community", "wide"],
  queryFn: () => listPosts({ data: { category: "events-community", perPage: 40, compact: true } }),
  staleTime: 5 * 60 * 1000,
});

/**
 * Only the major temple programs surface here — the full temple schedule lives
 * in the Temple Calendar so recurring pujas never flood general Events.
 */
const featuredTempleQuery = queryOptions({
  queryKey: ["temple-events", "featured"],
  queryFn: () => listTempleEvents({ data: { featuredOnly: true, limit: 8 } }),
  staleTime: 30 * 60 * 1000,
});

const TITLE = "Bay Area Events Calendar — festivals, meetups & temple programs";
const DESC =
  "Verified community events across San Francisco, San Jose, Fremont and the Tri-Valley: dates, venues, ticket prices and directions.";

const EVENTS_URL = "https://bayarea-telugu-vibe.lovable.app/events";

export const Route = createFileRoute("/events/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: EVENTS_URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: EVENTS_URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Bay Area community events",
          itemListElement: EVENTS.map((e, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: {
              "@type": "Event",
              name: e.title,
              startDate: e.start,
              ...(e.end ? { endDate: e.end } : {}),
              eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
              eventStatus: "https://schema.org/EventScheduled",
              organizer: { "@type": "Organization", name: e.organiser },
              offers: {
                "@type": "Offer",
                price: e.free ? "0" : (e.cost ?? "0").replace(/[^0-9.]/g, "") || "0",
                priceCurrency: "USD",
                availability: "https://schema.org/InStock",
                ...(e.registerUrl ? { url: e.registerUrl } : {}),
              },
              location: {
                "@type": "Place",
                name: e.venue,
                address: {
                  "@type": "PostalAddress",
                  streetAddress: e.address,
                  addressLocality: e.city,
                  addressRegion: "CA",
                  addressCountry: "US",
                },
              },
            },
          })),
        }),
      },
    ],
  }),
  component: EventsPage,
});

function EventsPage() {
  const { t } = useLang();
  const { data: live = [] } = useQuery(liveEventsQuery);
  const { data: eventPosts = [] } = useQuery(eventPostsQuery);
  const { data: templeFeatured = [] } = useQuery(featuredTempleQuery);
  const seen = new Set<string>();
  const liveRows = [
    ...live.map((e) => ({
      key: `c-${e.id}`,
      title: e.title,
      href: e.link_url && !e.link_url.startsWith("/") ? e.link_url : null,
      image: e.image_url ?? null,
      summary: e.summary ?? null,
      source: e.link_url ?? null,
      city: e.city ?? null,
      meta: [e.city, e.event_start ? formatDate(e.event_start) : e.venue].filter(Boolean).join(" · "),
    })),
    ...eventPosts.map((a) => ({
      key: `p-${a.id}`,
      title: a.title,
      href: a.sourceUrl ?? null,
      image: a.image ?? null,
      summary: a.excerpt ?? null,
      source: a.sourceUrl ?? null,
      city: null as string | null,
      meta: [a.categoryName, formatDate(a.date)].filter(Boolean).join(" · "),
    })),
  ]
    // Bay Area calendar only. The collector stamps every row's city as "Bay
    // Area" and AI summaries sometimes name it too, so relevance is judged on
    // the headline, the publisher, or a specific (non-generic) city stamp.
    .filter((r) => !classifyIndia(r.title, r.summary, r.source))
    .filter(
      (r) =>
        isBayArea(r.title) ||
        isBayAreaSource(r.source) ||
        (r.city && r.city.toLowerCase() !== "bay area" && isBayArea(r.city)),
    )
    .filter((r) => {
      const k = r.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 40);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });

  const { filter, setFilter, filtered } = useEventFilter(upcomingEvents());
  const weekend = weekendEvents().filter((w) => filtered.some((f) => f.id === w.id));
  const upcoming = filtered.filter((e) => !weekend.some((w) => w.id === e.id));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:py-8">
      <h1 className="text-3xl font-bold text-ink">
        {t("Bay Area Events", "బే ఏరియా ఈవెంట్స్")}
      </h1>
      <p className="mt-2 text-base text-muted-foreground">
        {t(
          "Festivals, temple programs, association meetups and community services across San Francisco, San Jose, Fremont and the Tri-Valley.",
          "శాన్ ఫ్రాన్సిస్కో, శాన్ జోస్, ఫ్రీమాంట్, ట్రై-వ్యాలీ అంతటా పండుగలు, ఆలయ కార్యక్రమాలు, సంఘ సమావేశాలు.",
        )}
      </p>

      <div className="mt-6">
        <EventFilterBar filter={filter} onChange={setFilter} />
      </div>

      {templeFeatured.length > 0 && (
        <section className="mt-8">
          <SectionHeading te="ప్రధాన ఆలయ కార్యక్రమాలు" en="Major temple programs" />
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {templeFeatured.map((e) => {
              const day = formatEventDay(e.startsAt);
              return (
                <li key={e.id} className="flex items-start gap-3 p-3">
                  <div className="w-14 flex-none rounded-md bg-primary/10 px-2 py-1 text-center">
                    <p className="text-[10px] font-bold tracking-wide text-primary">{day.dow}</p>
                    <p className="text-xs font-semibold text-ink">{day.date}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-ink">{e.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {[e.templeName, e.city, formatEventTime(e.startsAt, e.allDay)]
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
            {t("View the full Temple Calendar →", "పూర్తి ఆలయ క్యాలెండర్ →")}
          </Link>
        </section>
      )}

      {liveRows.length > 0 && (
        <section className="mt-8">
          <SectionHeading te="తాజా ఈవెంట్స్" en="Latest listings" />
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {liveRows.map((r) => (
              <li key={r.key} className="flex items-start gap-3 p-3">
                {r.image && (
                  <img
                    src={r.image}
                    alt={r.title}
                    loading="lazy"
                    className="h-16 w-16 flex-none rounded-md object-cover"
                  />
                )}
                <div className="min-w-0">
                  {r.href ? (
                    <a
                      href={r.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-base font-semibold text-ink"
                    >
                      {r.title}
                    </a>
                  ) : (
                    <span className="text-base font-semibold text-ink">{r.title}</span>
                  )}
                  {r.meta && <p className="mt-1 text-sm text-muted-foreground">{r.meta}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {weekend.length > 0 && (
        <section className="mt-8">
          <SectionHeading te="ఈ వారాంతం" en="This Weekend" />
          <div className="grid gap-4 md:grid-cols-2">
            {weekend.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <SectionHeading te="రాబోయే ఈవెంట్స్" en="Upcoming Events" />
        <div className="grid gap-4 md:grid-cols-2">
          {upcoming.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      </section>

      <p className="mt-8 text-base text-muted-foreground">
        {t("Hosting an event?", "ఈవెంట్ నిర్వహిస్తున్నారా?")}{" "}
        <Link to="/contact" className="font-semibold text-primary">
          {t("Submit it for free", "ఉచితంగా పంపండి")}
        </Link>{" "}
        {t(
          "— every listing is confirmed with the organiser before it is marked verified.",
          "— ప్రతి ఈవెంట్ నిర్వాహకులతో నిర్ధారించిన తర్వాతే ప్రచురిస్తాము.",
        )}
      </p>
    </div>
  );
}
