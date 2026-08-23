import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, X } from "lucide-react";
import { PropertyVideo } from "@/components/property-video";
import {
  EPAPER_ANNIVERSARY_URL,
  PROPERTY_FEATURES,
  propertyImage,
  propertyVideoSearchUrl,
  type PropertyFeature,
} from "@/lib/property-showcase";

const TITLE = "Property — Hyderabad high-rise projects | Times Bay Area";
const DESCRIPTION =
  "Individual skyscraper property features from the Telugu Times 23rd Anniversary Special — Hyderabad towers, developers and project highlights for NRI buyers.";

export const Route = createFileRoute("/property/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: propertyImage("3-1") },
      { name: "twitter:image", content: propertyImage("3-1") },
    ],
  }),
  component: PropertyIndex,
});

/** One skyscraper feature: the printed page as a single vertical picture. */
function FeatureCard({ item, onOpen }: { item: PropertyFeature; onOpen: () => void }) {
  return (
    <figure className="m-0 overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`View ${item.project} full page`}
        className="block w-full"
      >
        <img
          src={propertyImage(item.id)}
          alt={`${item.project} by ${item.developer} — anniversary edition feature`}
          loading="lazy"
          decoding="async"
          width={1110}
          height={1559}
          className="aspect-[1110/1559] w-full bg-muted object-cover object-top transition-transform duration-300 hover:scale-[1.02]"
        />
      </button>
      <figcaption className="space-y-1 p-3">
        {item.videoId ? (
          <div className="pb-1">
            <PropertyVideo videoId={item.videoId} label={item.project} />
          </div>
        ) : null}
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
          {item.developer}
        </p>
        <h2 className="text-sm font-bold leading-snug text-ink">{item.project}</h2>
        {item.location ? (
          <p className="text-xs text-muted-foreground">{item.location}</p>
        ) : null}
        {item.note ? <p className="text-xs text-muted-foreground">{item.note}</p> : null}
        {!item.videoId ? (
          <a
            href={propertyVideoSearchUrl(item)}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1 pt-1 text-xs font-semibold text-primary hover:underline"
          >
            Find video tours
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
          </a>
        ) : null}
        {item.site ? (
          <a
            href={item.site}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1 pt-1 text-xs font-semibold text-primary hover:underline"
          >
            Project site
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
          </a>
        ) : null}
      </figcaption>
    </figure>
  );
}

function PropertyIndex() {
  const [open, setOpen] = useState<PropertyFeature | null>(null);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Property</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Hyderabad high-rise projects, one picture per project, as featured in the{" "}
          <a
            href={EPAPER_ANNIVERSARY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary hover:underline"
          >
            Telugu Times 23rd Anniversary Special
          </a>
          .
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to="/property/$campaign"
            params={{ campaign: "credai-hyderabad-2026" }}
            className="inline-flex min-h-10 items-center rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary-dark"
          >
            CREDAI Property Show 2026
          </Link>
          <a
            href={EPAPER_ANNIVERSARY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-semibold text-ink hover:border-primary"
          >
            Read the ePaper edition
            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
          </a>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {PROPERTY_FEATURES.map((item) => (
          <FeatureCard key={item.id} item={item} onOpen={() => setOpen(item)} />
        ))}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Project artwork and claims are the advertisers&apos; own, reproduced from the Telugu Times
        anniversary edition. Verify RERA details with the developer before buying.
      </p>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${open.project} full page`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-4"
          onClick={() => setOpen(null)}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(null)}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-ink/70 text-primary-foreground"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
          <img
            src={propertyImage(open.id)}
            alt={`${open.project} by ${open.developer}`}
            className="max-h-[90vh] w-auto max-w-full rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}
