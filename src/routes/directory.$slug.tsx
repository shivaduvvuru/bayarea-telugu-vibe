import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { queryOptions } from "@tanstack/react-query";
import { getDirectoryEntity } from "@/lib/directory.functions";
import { categoryOf, subcategoryLabel } from "@/lib/directory-taxonomy";
import { canonical, SITE_NAME } from "@/lib/site";
import { COMMUNITY_EMAIL } from "@/lib/community-data";
import type { DirectoryEntity } from "@/lib/directory";

const listingQuery = (slug: string) =>
  queryOptions({
    queryKey: ["directory", "entity", slug],
    queryFn: () => getDirectoryEntity({ data: { slug } }),
    staleTime: 10 * 60 * 1000,
  });

/** Most specific schema.org type we can justify from the stored category. */
function schemaType(e: DirectoryEntity): string {
  switch (e.category) {
    case "food":
      return e.subcategory && /grocer|market|shop/.test(e.subcategory) ? "GroceryStore" : "Restaurant";
    case "religious":
      return /temple|hindu/.test(`${e.subcategory ?? ""} ${e.name}`.toLowerCase())
        ? "HinduTemple"
        : "PlaceOfWorship";
    case "health":
      return "MedicalBusiness";
    case "shopping":
      return "Store";
    case "education":
      return "EducationalOrganization";
    default:
      return "LocalBusiness";
  }
}

function directionsUrl(e: DirectoryEntity) {
  if (e.latitude != null && e.longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${e.latitude},${e.longitude}`;
  }
  const q = [e.name, e.address, e.city, e.state].filter(Boolean).join(", ");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}

export const Route = createFileRoute("/directory/$slug")({
  loader: async ({ params, context }) => {
    const entity = (await context.queryClient.ensureQueryData(
      listingQuery(params.slug),
    )) as DirectoryEntity | null;
    if (!entity) throw notFound();
    return { entity };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Listing not found" }, { name: "robots", content: "noindex" }] };
    }
    const e = loaderData.entity;
    const place = [e.city, e.county].filter(Boolean).join(", ");
    const title = `${e.name}${place ? ` — ${place}` : ""} | Bay Area Local Directory`;
    const desc =
      (e.description && e.description.slice(0, 155)) ||
      `${e.name}${e.address ? ` at ${e.address}` : ""}${place ? ` in ${place}` : ""}. Contact details, hours and directions in the ${SITE_NAME} local directory.`;
    const url = canonical(`/directory/${e.slug}`);
    const cat = categoryOf(e.category);
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: e.image ? "summary_large_image" : "summary" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: desc },
    ];
    if (e.image) {
      meta.push({ property: "og:image", content: e.image });
      meta.push({ name: "twitter:image", content: e.image });
    }

    const business: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": schemaType(e),
      name: e.name,
      url,
      ...(e.description ? { description: e.description } : {}),
      ...(e.phone ? { telephone: e.phone } : {}),
      ...(e.website ? { sameAs: [e.website] } : {}),
      ...(e.image ? { image: [e.image] } : {}),
      ...(e.hours ? { openingHours: e.hours } : {}),
      ...(e.price_level ? { priceRange: "$".repeat(Math.max(1, Math.min(4, e.price_level))) } : {}),
      address: {
        "@type": "PostalAddress",
        ...(e.address ? { streetAddress: e.address } : {}),
        ...(e.city ? { addressLocality: e.city } : {}),
        addressRegion: e.state || "CA",
        ...(e.zip ? { postalCode: e.zip } : {}),
        addressCountry: "US",
      },
      ...(e.latitude != null && e.longitude != null
        ? {
            geo: {
              "@type": "GeoCoordinates",
              latitude: e.latitude,
              longitude: e.longitude,
            },
          }
        : {}),
      ...(e.tba_review_count > 0 && e.tba_rating != null
        ? {
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: e.tba_rating,
              reviewCount: e.tba_review_count,
            },
          }
        : {}),
    };

    const crumbs = [
      { name: "Home", item: canonical("/") },
      { name: "Directory", item: canonical("/directory") },
      ...(cat
        ? [{ name: cat.label, item: canonical(`/directory?category=${e.category}`) }]
        : []),
      { name: e.name, item: url },
    ];

    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(business) },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: crumbs.map((c, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: c.name,
              item: c.item,
            })),
          }),
        },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-ink">Listing not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        It may have been merged with another record.
      </p>
      <Link to="/directory" className="mt-6 inline-block font-semibold text-primary">
        Browse the directory
      </Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center" role="alert">
      <p className="text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  component: ListingPage,
});

function ListingPage() {
  const { entity: e } = Route.useLoaderData();
  const cat = categoryOf(e.category);
  const subLabel = subcategoryLabel(e.category, e.subcategory);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link to="/" className="hover:text-primary">
              Home
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li>
            <Link to="/directory" className="hover:text-primary">
              Directory
            </Link>
          </li>
          {cat && (
            <>
              <li aria-hidden>›</li>
              <li>
                <Link
                  to="/directory"
                  search={{ category: e.category }}
                  className="hover:text-primary"
                >
                  {cat.label}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden>›</li>
          <li className="font-semibold text-ink">{e.name}</li>
        </ol>
      </nav>

      <h1 className="mt-3 text-3xl font-bold text-ink">{e.name}</h1>
      <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-primary">
        {[cat?.label, subLabel, e.city, e.county].filter(Boolean).join(" · ")}
      </p>

      {e.image && (
        <img
          src={e.image}
          alt={e.name}
          width={1200}
          height={675}
          className="mt-4 w-full bg-surface-tint object-cover"
          loading="eager"
        />
      )}

      {e.description && (
        <p className="mt-4 text-[17px] leading-relaxed text-foreground">{e.description}</p>
      )}

      <dl className="mt-5 grid gap-2 border-y border-border py-4 text-sm text-foreground sm:grid-cols-2">
        {e.address && (
          <div>
            <dt className="font-semibold text-ink">Address</dt>
            <dd>
              {e.address}
              {e.city ? `, ${e.city}` : ""} {e.state} {e.zip ?? ""}
            </dd>
          </div>
        )}
        {e.county && (
          <div>
            <dt className="font-semibold text-ink">County</dt>
            <dd>{e.county}</dd>
          </div>
        )}
        {e.phone && (
          <div>
            <dt className="font-semibold text-ink">Phone</dt>
            <dd>
              <a href={`tel:${e.phone.replace(/\s+/g, "")}`} className="text-primary hover:underline">
                {e.phone}
              </a>
            </dd>
          </div>
        )}
        {e.website && (
          <div>
            <dt className="font-semibold text-ink">Website</dt>
            <dd>
              <a
                href={e.website}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="break-all text-primary hover:underline"
              >
                {e.website}
              </a>
            </dd>
          </div>
        )}
        {e.hours && (
          <div>
            <dt className="font-semibold text-ink">Hours</dt>
            <dd>{e.hours}</dd>
          </div>
        )}
        {e.price_level != null && (
          <div>
            <dt className="font-semibold text-ink">Price</dt>
            <dd>{"$".repeat(Math.max(1, Math.min(4, e.price_level)))}</dd>
          </div>
        )}
        {e.accessibility && (
          <div>
            <dt className="font-semibold text-ink">Accessibility</dt>
            <dd>{e.accessibility}</dd>
          </div>
        )}
        {e.deity && (
          <div>
            <dt className="font-semibold text-ink">Deity</dt>
            <dd>{e.deity}</dd>
          </div>
        )}
        {e.tba_review_count > 0 && e.tba_rating != null && (
          <div>
            <dt className="font-semibold text-ink">Community rating</dt>
            <dd>
              {e.tba_rating.toFixed(1)} / 5 from {e.tba_review_count} review
              {e.tba_review_count === 1 ? "" : "s"}
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
        <a
          href={directionsUrl(e)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-sm border border-primary px-4 py-2 text-primary hover:bg-primary hover:text-primary-foreground"
        >
          Get directions
        </a>
        {e.events_url && (
          <a
            href={e.events_url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="rounded-sm border border-border px-4 py-2 text-ink hover:border-primary"
          >
            Events & calendar
          </a>
        )}
        <a
          href={`mailto:${COMMUNITY_EMAIL}?subject=${encodeURIComponent(`Directory correction: ${e.name}`)}`}
          className="rounded-sm border border-border px-4 py-2 text-muted-foreground hover:border-primary hover:text-primary"
        >
          Suggest a correction
        </a>
      </div>

      {/* ODbL requires the stored OpenStreetMap credit to stay visible. */}
      <p className="mt-6 text-[11px] text-muted-foreground">
        {e.verified_status ? "Owner verified · " : ""}
        {e.attribution ?? "Community listing"}
        {e.external_url && (
          <>
            {" · "}
            <a
              href={e.external_url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="hover:text-primary"
            >
              source record
            </a>
          </>
        )}
      </p>
    </div>
  );
}
