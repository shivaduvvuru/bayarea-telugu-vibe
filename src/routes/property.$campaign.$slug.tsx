import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, BadgeCheck, ExternalLink, MapPin, Phone } from "lucide-react";
import { getProperty, trackPropertyEvent } from "@/lib/property.functions";
import { campaignPath, priceLabel } from "@/lib/property";
import { PropertyCard } from "@/components/property-card";
import { PropertyEnquiry } from "@/components/property-enquiry";
import { WhatsAppShare } from "@/components/whatsapp-share";
import { canonical, SITE_NAME } from "@/lib/site";

const propertyQuery = (campaign: string, slug: string) =>
  queryOptions({
    queryKey: ["property", "detail", campaign, slug],
    queryFn: () => getProperty({ data: { campaign, slug } }),
    staleTime: 15 * 60 * 1000,
  });

export const Route = createFileRoute("/property/$campaign/$slug")({
  loader: async ({ params, context }) => {
    const data = await context.queryClient.ensureQueryData(
      propertyQuery(params.campaign, params.slug),
    );
    if (!data.property) throw notFound();
    return { property: data.property };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Project unavailable" }, { name: "robots", content: "noindex" }] };
    }
    const p = loaderData.property;
    const title = `${p.project_name} by ${p.developer}${p.locality ? `, ${p.locality}` : ""} | ${SITE_NAME}`;
    const description =
      p.description?.slice(0, 155) ??
      `${p.project_name} by ${p.developer}${p.configuration ? ` — ${p.configuration}` : ""}. ${priceLabel(p)}.`;
    const url = canonical(`/property/${params.campaign}/${params.slug}`);
    const meta = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "product" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (p.image_url?.startsWith("https://")) {
      meta.push(
        { property: "og:image", content: p.image_url },
        { name: "twitter:image", content: p.image_url },
      );
    }
    return { meta, links: [{ rel: "canonical", href: url }] };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-ink">Project not found</h1>
      <Link to="/" className="mt-4 inline-block text-sm font-bold text-primary">
        Back to the homepage
      </Link>
    </div>
  ),
  component: PropertyDetail,
});

function PropertyDetail() {
  const { campaign, slug } = Route.useParams();
  const { data } = useSuspenseQuery(propertyQuery(campaign, slug));
  const p = data.property!;
  const [selected, setSelected] = useState([p]);

  useEffect(() => {
    void trackPropertyEvent({
      data: {
        campaignSlug: campaign,
        kind: "project_view",
        propertyId: p.id,
        projectName: p.project_name,
        developer: p.developer,
        path: `/property/${campaign}/${slug}`,
      },
    }).catch(() => undefined);
  }, [campaign, slug, p.id, p.project_name, p.developer]);

  function developerClick() {
    void trackPropertyEvent({
      data: {
        campaignSlug: campaign,
        kind: "developer_click",
        propertyId: p.id,
        projectName: p.project_name,
        developer: p.developer,
      },
    }).catch(() => undefined);
  }

  const images = [p.image_url, ...p.gallery_urls].filter((v): v is string => !!v);

  return (
    <div className="rise mx-auto max-w-5xl px-3 py-4">
      <Link
        to={campaignPath(campaign)}
        className="inline-flex items-center gap-1 text-xs font-bold text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All projects
      </Link>

      <h1 className="mt-2 text-2xl font-black leading-tight text-ink sm:text-3xl">
        {p.project_name}
      </h1>
      <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {p.developer}
      </p>

      {images.length > 0 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {images.slice(0, 4).map((src, i) => (
            <img
              key={src}
              src={src}
              alt={`${p.project_name} by ${p.developer}`}
              {...(i === 0 ? {} : { loading: "lazy" as const })}
              className={`w-full rounded-lg object-cover ${
                i === 0 ? "h-[260px] sm:col-span-2 sm:h-[360px]" : "h-[160px]"
              }`}
            />
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-3">
            <Fact label="Starting price" value={priceLabel(p)} />
            <Fact label="Configuration" value={p.configuration} />
            <Fact label="Status" value={p.project_status} />
            <Fact label="Type" value={p.property_type} />
            <Fact label="Location" value={[p.locality, p.zone].filter(Boolean).join(" · ")} />
            <Fact label="RERA" value={p.rera_number} />
          </dl>
          {p.price_note ? (
            <p className="mt-2 text-xs text-muted-foreground">{p.price_note}</p>
          ) : null}

          {p.description ? (
            <section className="mt-5">
              <h2 className="border-b-2 border-primary pb-1 text-sm font-bold uppercase tracking-wide text-ink">
                About the project
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-ink">{p.description}</p>
            </section>
          ) : null}

          {p.amenities.length > 0 ? (
            <section className="mt-5">
              <h2 className="border-b-2 border-primary pb-1 text-sm font-bold uppercase tracking-wide text-ink">
                Amenities
              </h2>
              <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {p.amenities.map((a) => (
                  <li key={a} className="flex items-start gap-1.5 text-sm text-ink">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    {a}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <PropertyEnquiry
            campaignSlug={campaign}
            selected={selected}
            onClear={() => setSelected([p])}
            className="mt-6"
          />
        </div>

        <aside className="space-y-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
              Developer contact
            </p>
            <div className="mt-2 space-y-2">
              {p.website_url ? (
                <a
                  href={p.website_url}
                  target="_blank"
                  rel="noreferrer nofollow sponsored"
                  onClick={developerClick}
                  className="flex items-center gap-1.5 text-sm font-bold text-primary"
                >
                  Developer website <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              ) : null}
              {p.enquiry_url ? (
                <a
                  href={p.enquiry_url}
                  target="_blank"
                  rel="noreferrer nofollow sponsored"
                  onClick={developerClick}
                  className="flex items-center gap-1.5 text-sm font-bold text-primary"
                >
                  Official enquiry form <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              ) : null}
              {p.contact_phone ? (
                <a
                  href={`tel:${p.contact_phone}`}
                  onClick={developerClick}
                  className="flex items-center gap-1.5 text-sm font-bold text-primary"
                >
                  <Phone className="h-3.5 w-3.5" aria-hidden /> {p.contact_phone}
                </a>
              ) : null}
              {!p.website_url && !p.enquiry_url && !p.contact_phone ? (
                <p className="text-xs text-muted-foreground">
                  Use the enquiry form and the property desk will connect you.
                </p>
              ) : null}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <WhatsAppShare
                path={`/property/${campaign}/${slug}`}
                title={`${p.project_name} — ${p.developer}`}
                context="property-detail"
                label="Share project"
              />
            </div>
          </div>

          {p.source_url ? (
            <p className="rounded-lg border border-border bg-surface-tint p-3 text-[11px] text-muted-foreground">
              Project information published by{" "}
              <a
                href={p.source_url}
                target="_blank"
                rel="noreferrer"
                className="font-bold text-primary"
              >
                {p.source_name ?? "the source"}
              </a>
              . Telugu Times is a media partner, not a broker. Verify all details with the
              developer.
            </p>
          ) : null}

          {p.locality ? (
            <p className="flex items-center gap-1.5 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {p.locality}
              {p.zone && p.zone !== p.locality ? `, ${p.zone}` : ""}
            </p>
          ) : null}
        </aside>
      </div>

      {data.related.length > 0 ? (
        <section className="mt-8">
          <h2 className="border-b-2 border-primary pb-1 text-sm font-bold uppercase tracking-wide text-ink">
            Other projects in this showcase
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.related.map((r) => (
              <PropertyCard key={r.id} property={r} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Fact({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}
