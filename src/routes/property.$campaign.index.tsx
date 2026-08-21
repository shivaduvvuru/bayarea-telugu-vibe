import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { CalendarDays, ExternalLink, MapPin, ShieldCheck } from "lucide-react";
import { getCampaign, trackPropertyEvent } from "@/lib/property.functions";
import {
  PROJECT_STATUSES,
  PROPERTY_TYPES,
  campaignPhase,
  eventDateLabel,
  localities,
  rankProperties,
  usableBudgetBands,
  type Property,
  type PropertyFilters,
} from "@/lib/property";
import { PropertyCard } from "@/components/property-card";
import { DeveloperLineup } from "@/components/developer-lineup";
import { NriGuides } from "@/components/nri-guides";
import { PropertyLiveFeed } from "@/components/property-live-feed";
import { PropertyEnquiry } from "@/components/property-enquiry";
import { WhatsAppShare } from "@/components/whatsapp-share";
import { canonical, SITE_NAME } from "@/lib/site";
import skyline from "@/assets/hyderabad-skyline.jpg";

const campaignQuery = (slug: string) =>
  queryOptions({
    queryKey: ["property", "campaign", slug],
    queryFn: () => getCampaign({ data: { slug } }),
    staleTime: 15 * 60 * 1000,
  });

export const Route = createFileRoute("/property/$campaign/")({
  loader: async ({ params, context }) => {
    const data = await context.queryClient.ensureQueryData(campaignQuery(params.campaign));
    if (!data.campaign) throw notFound();
    return { campaign: data.campaign };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Property show unavailable" }, { name: "robots", content: "noindex" }] };
    }
    const c = loaderData.campaign;
    const dates = eventDateLabel(c);
    // Once the show is over the page stays indexable, but as an evergreen
    // highlights and featured-projects page rather than an event invitation.
    const isPast = campaignPhase(c) === "past";
    const title = isPast
      ? `${c.name} — Highlights & Featured Projects | ${SITE_NAME}`
      : `${c.name} — Projects, Dates & Enquiries | ${SITE_NAME}`;
    const description = isPast
      ? `Highlights from ${c.name}${dates ? ` (${dates})` : ""} plus the Hyderabad projects featured in Telugu Times, with developer details and enquiries.`
      : `${c.name}${dates ? `, ${dates}` : ""}${
          c.venue ? ` at ${c.venue}` : ""
        }. Browse Hyderabad projects from developers featured in Telugu Times and send an enquiry.`;
    const url = canonical(`/property/${params.campaign}`);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Event",
            name: c.name,
            startDate: c.event_start ?? undefined,
            endDate: c.event_end ?? undefined,
            eventStatus: "https://schema.org/EventScheduled",
            eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
            location: c.venue
              ? { "@type": "Place", name: c.venue, address: c.city ?? undefined }
              : undefined,
            organizer: c.organizer ? { "@type": "Organization", name: c.organizer } : undefined,
            url,
          }),
        },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-ink">Property show not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This campaign is no longer running.
      </p>
      <Link to="/" className="mt-4 inline-block text-sm font-bold text-primary">
        Back to the homepage
      </Link>
    </div>
  ),
  component: CampaignPage,
});

function CampaignPage() {
  const { campaign: slug } = Route.useParams();
  const { data } = useSuspenseQuery(campaignQuery(slug));
  const campaign = data.campaign!;
  const [filters, setFilters] = useState<PropertyFilters>({});
  const [selected, setSelected] = useState<Property[]>([]);

  useEffect(() => {
    void trackPropertyEvent({
      data: {
        campaignSlug: slug,
        kind: "page_view",
        path: `/property/${slug}`,
        referrer: typeof document !== "undefined" ? document.referrer.slice(0, 300) : undefined,
      },
    }).catch(() => undefined);
  }, [slug]);

  const ranked = useMemo(() => rankProperties(data.properties, filters), [data.properties, filters]);
  const places = useMemo(() => localities(data.properties), [data.properties]);
  const bands = useMemo(() => usableBudgetBands(data.properties), [data.properties]);
  const types = PROPERTY_TYPES.filter((t) => data.properties.some((p) => p.property_type === t));
  const statuses = PROJECT_STATUSES.filter((s) =>
    data.properties.some((p) => p.project_status === s),
  );
  const phase = campaignPhase(campaign);
  const past = phase === "past";
  const dates = eventDateLabel(campaign);
  const venueLabel = (campaign.venue ?? "the venue").split(",")[0]!.trim();

  function toggle(p: Property) {
    setSelected((prev) =>
      prev.some((s) => s.id === p.id) ? prev.filter((s) => s.id !== p.id) : [...prev, p],
    );
  }

  const chip =
    "rounded-full border px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap";
  const on = "border-primary bg-primary text-primary-foreground";
  const off = "border-border text-ink hover:bg-surface-tint";

  return (
    <div className="rise mx-auto max-w-6xl px-3 py-4">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-xl">
        <img
          src={campaign.hero_image_url ?? skyline}
          alt="Hyderabad skyline with high-rise residential towers at sunset"
          width={1920}
          height={1088}
          className="h-[240px] w-full object-cover sm:h-[340px]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
            {past ? "Highlights & featured projects" : campaign.organizer ?? "Property show"}
          </p>
          <h1 className="mt-1 max-w-3xl text-2xl font-black leading-tight text-white sm:text-4xl">
            {past ? `${campaign.name} — highlights & featured projects` : campaign.headline}
          </h1>
          {campaign.subheading && !past ? (
            <p className="mt-2 max-w-2xl text-sm text-white/85">{campaign.subheading}</p>
          ) : null}
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-white/90">
            {dates ? (
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" aria-hidden />
                {dates}
              </span>
            ) : null}
            {campaign.venue ? (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" aria-hidden />
                {campaign.venue}
              </span>
            ) : null}
            {campaign.opening_hours ? <span>{campaign.opening_hours}</span> : null}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <a
              href="#enquire"
              className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              Request project details
            </a>
            <a
              href="#projects"
              className="rounded-full bg-white/15 px-4 py-2 text-xs font-bold text-white backdrop-blur hover:bg-white/25"
            >
              {past ? "Featured projects" : "Browse projects"}
            </a>
            <WhatsAppShare
              path={`/property/${slug}`}
              title={campaign.name}
              context="property-campaign"
              tone="light"
              label="Share"
            />
          </div>
        </div>
      </section>

      {/* Event facts + venue */}
      <section className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
            {past ? "Show dates" : "When"}
          </p>
          <p className="mt-1 text-sm font-semibold text-ink">
            {dates || "Dates to be announced"}
          </p>
          {campaign.opening_hours ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{campaign.opening_hours}</p>
          ) : null}
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-primary">Where</p>
          <p className="mt-1 text-sm font-semibold text-ink">{campaign.venue ?? "Venue to be announced"}</p>
          {campaign.map_url ? (
            <a
              href={campaign.map_url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-primary"
            >
              Map & directions <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          ) : null}
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-primary">Organiser</p>
          <p className="mt-1 text-sm font-semibold text-ink">{campaign.organizer ?? "—"}</p>
          {campaign.official_url ? (
            <a
              href={campaign.official_url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-primary"
            >
              Official coverage <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          ) : null}
        </div>
      </section>

      {campaign.participation_note ? (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-surface-tint p-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          {campaign.participation_note}
        </p>
      ) : null}

      <PropertyLiveFeed
        campaignSlug={slug}
        live={campaign.live_mode && !past}
        note={campaign.live_note}
        venueLabel={venueLabel}
      />

      <DeveloperLineup campaignSlug={slug} properties={data.properties} />

      {/* Projects */}
      <section id="projects" className="mt-8">
        <h2 className="border-b-2 border-primary pb-1 text-sm font-bold uppercase tracking-wide text-ink">
          Featured projects
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">
          {past
            ? "Projects that featured in this showcase remain listed here. Details are as published by the developer — verify approvals, pricing and timelines before you commit."
            : "Projects promoted by developers advertising with Telugu Times. Details are as published by the developer — verify approvals, pricing and timelines before you commit."}
        </p>

        <div className="mt-3 space-y-2">
          <FilterRow label="Location">
            <button
              type="button"
              onClick={() => setFilters((f) => ({ ...f, locality: undefined }))}
              className={`${chip} ${!filters.locality ? on : off}`}
            >
              All
            </button>
            {places.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setFilters((f) => ({ ...f, locality: l }))}
                className={`${chip} ${filters.locality === l ? on : off}`}
              >
                {l}
              </button>
            ))}
          </FilterRow>

          {bands.length > 1 ? (
            <FilterRow label="Budget">
              <button
                type="button"
                onClick={() => setFilters((f) => ({ ...f, budget: undefined }))}
                className={`${chip} ${!filters.budget ? on : off}`}
              >
                Any
              </button>
              {bands.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, budget: b.key }))}
                  className={`${chip} ${filters.budget === b.key ? on : off}`}
                >
                  {b.label}
                </button>
              ))}
            </FilterRow>
          ) : null}

          {types.length > 1 ? (
            <FilterRow label="Type">
              <button
                type="button"
                onClick={() => setFilters((f) => ({ ...f, type: undefined }))}
                className={`${chip} ${!filters.type ? on : off}`}
              >
                All
              </button>
              {types.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, type: t }))}
                  className={`${chip} ${filters.type === t ? on : off}`}
                >
                  {t}
                </button>
              ))}
            </FilterRow>
          ) : null}

          {statuses.length > 1 ? (
            <FilterRow label="Status">
              <button
                type="button"
                onClick={() => setFilters((f) => ({ ...f, status: undefined }))}
                className={`${chip} ${!filters.status ? on : off}`}
              >
                All
              </button>
              {statuses.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, status: s }))}
                  className={`${chip} ${filters.status === s ? on : off}`}
                >
                  {s}
                </button>
              ))}
            </FilterRow>
          ) : null}
        </div>

        {ranked.length === 0 ? (
          <p className="mt-4 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            No projects match these filters yet. Clear a filter, or send an enquiry and the property
            desk will share matching options.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ranked.map((p) => (
              <PropertyCard
                key={p.id}
                property={p}
                selected={selected.some((s) => s.id === p.id)}
                onToggle={toggle}
              />
            ))}
          </div>
        )}
      </section>

      <NriGuides />

      {/* Enquiry */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <PropertyEnquiry
          campaignSlug={slug}
          selected={selected}
          onClear={() => setSelected([])}
        />

        <aside className="space-y-4">

          <section className="rounded-lg border border-primary/30 bg-surface-tint p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink">
              Advertise in this showcase
            </h2>
            <p className="mt-2 text-xs text-muted-foreground">
              Telugu Times reaches Telugu families across the Bay Area and the wider U.S. diaspora.
              Developers listed here get a project page, enquiry capture and a monthly report of
              views and enquiries by project and country.
            </p>
            <Link
              to="/contact"
              className="mt-3 inline-block rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              Talk to the property desk
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="scrollbar-none flex gap-1.5 overflow-x-auto py-0.5">{children}</div>
    </div>
  );
}
