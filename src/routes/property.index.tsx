import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, X } from "lucide-react";
import { PropertyVideo } from "@/components/property-video";
import { PropertyVideoSources } from "@/components/property-video-sources";
import {
  getPropertyVideos,
  trackPropertyVideoClick,
} from "@/lib/property-videos.functions";
import {
  EPAPER_ANNIVERSARY_URL,
  PROPERTY_FEATURES,
  propertyImage,
  type PropertyFeature,
} from "@/lib/property-showcase";

const TITLE = "Property — Hyderabad high-rise projects | Times Bay Area";
const DESCRIPTION =
  "Individual skyscraper property features from our 23rd Anniversary Special — Hyderabad towers, developers, short video tours and project highlights for NRI buyers.";

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
function FeatureCard({
  item,
  videoId,
  clicks,
  onOpen,
  onPlay,
}: {
  item: PropertyFeature;
  videoId?: string | undefined;
  clicks?: number | undefined;
  onOpen: () => void;
  onPlay: () => void;
}) {
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
        {videoId ? (
          <div className="pb-1">
            <PropertyVideo
              videoId={videoId}
              label={item.project}
              {...(typeof clicks === "number" ? { clicks } : {})}
              onPlay={onPlay}
            />
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
        {!videoId ? (
          <div className="pt-1">
            <PropertyVideoSources
              project={item.project}
              developer={item.developer}
              {...(item.location ? { location: item.location } : {})}
              {...(item.note ? { note: item.note } : {})}
              {...(item.site ? { site: item.site } : {})}
            />
          </div>
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
  const [videoOnly, setVideoOnly] = useState(false);
  const loadVideos = useServerFn(getPropertyVideos);
  const trackClick = useServerFn(trackPropertyVideoClick);

  const { data } = useQuery({
    queryKey: ["property-videos"],
    queryFn: () => loadVideos(),
    staleTime: 5 * 60 * 1000,
  });

  /** Desk-verified clips win; the printed edition ids are the fallback. */
  const videoFor = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of PROPERTY_FEATURES) if (item.videoId) map.set(item.id, item.videoId);
    for (const row of data?.videos ?? []) map.set(row.feature_id, row.video_id);
    return map;
  }, [data]);

  const clicks = data?.clicks ?? {};
  const withVideo = PROPERTY_FEATURES.filter((i) => videoFor.has(i.id));
  const shown = videoOnly ? withVideo : PROPERTY_FEATURES;

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
          <button
            type="button"
            onClick={() => setVideoOnly((v) => !v)}
            aria-pressed={videoOnly}
            className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold ${
              videoOnly
                ? "bg-ink text-primary-foreground"
                : "border border-border text-ink hover:border-primary"
            }`}
          >
            {videoOnly ? "Showing video tours only" : "Only with video tours"}
            <span className="ml-1.5 text-xs font-bold opacity-80">({withVideo.length})</span>
          </button>
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
        {shown.map((item) => (
          <FeatureCard
            key={item.id}
            item={item}
            {...(videoFor.get(item.id) ? { videoId: videoFor.get(item.id) } : {})}
            {...(clicks[item.id] ? { clicks: clicks[item.id] } : {})}
            onOpen={() => setOpen(item)}
            onPlay={() => {
              void trackClick({
                data: {
                  featureId: item.id,
                  ...(videoFor.get(item.id) ? { videoId: videoFor.get(item.id)! } : {}),
                  project: item.project,
                  path: "/property",
                },
              }).catch(() => undefined);
            }}
          />
        ))}
      </div>

      {videoOnly && withVideo.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No verified short video tours are published yet. Turn the filter off to browse every
          project.
        </p>
      ) : null}

      <p className="mt-6 text-xs text-muted-foreground">
        Project artwork and claims are the advertisers&apos; own, reproduced from the
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
