import { createFileRoute, Link } from "@tanstack/react-router";
import { EVENTS, upcomingEvents, weekendEvents } from "@/lib/news-data";
import { EventCard } from "@/components/events";
import { SectionHeading } from "@/components/news";
import { useLang } from "@/lib/language";
import { EventFilterBar, useEventFilter } from "@/components/event-filters";

const TITLE = "Bay Area Telugu Events Calendar — festivals, meetups & temple programs";
const DESC =
  "Verified Telugu community events across San Francisco, San Jose, Fremont and the Tri-Valley: dates, venues, ticket prices and directions.";

const EVENTS_URL = "https://bayarea-telugu-vibe.lovable.app/events";

export const Route = createFileRoute("/events")({
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
          name: "Bay Area Telugu community events",
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
  const { filter, setFilter, filtered } = useEventFilter(upcomingEvents());
  const weekend = weekendEvents().filter((w) => filtered.some((f) => f.id === w.id));
  const upcoming = filtered.filter((e) => !weekend.some((w) => w.id === e.id));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:py-8">
      <h1 className="text-3xl font-bold text-ink">
        {t("Bay Area Telugu Events", "బే ఏరియా తెలుగు ఈవెంట్స్")}
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
