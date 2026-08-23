import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { listPosts } from "@/lib/content.functions";
import { listTempleAnnouncements } from "@/lib/temples.functions";
import { listPolitics } from "@/lib/politics.functions";
import { listCommunityItems } from "@/lib/cms.functions";
import { upcomingEvents } from "@/lib/news-data";
import { formatDate, isLocal, type Article } from "@/lib/content";
import { canonical } from "@/lib/site";
import { usableImage } from "@/lib/story-image";
import { contentDedupeKeys } from "@/lib/dedupe";
import { classifyItem, isUpcoming, whenLabel } from "@/lib/classify";
import { HousingHero } from "@/components/housing-hero";
import {
  isPrimeBannerFresh,
  pickPrimeStory,
  pickRotatingPrime,
  PRIME_ROTATE_MS,
} from "@/lib/prime-story";
import { isBayArea, isBayAreaSource } from "@/lib/bay-area";
import { classifyIndia } from "@/lib/india-topics";
import { DigestNote, SourceChip } from "@/components/source-credit";
import { RelativeDate, Thumb } from "@/components/news";
import { StoryActions } from "@/components/story-actions";
// The lightbox is only needed once a photo is tapped: keep it out of the
// initial mobile bundle.
const GalleryLightbox = lazy(() =>
  import("@/components/gallery-lightbox").then((m) => ({ default: m.GalleryLightbox })),
);

import { PhotoActions } from "@/components/photo-actions";
import { useFavoritePhotos, useHiddenPhotos } from "@/lib/photo-favorites";

import { RefreshGalleryButton } from "@/components/refresh-gallery-button";
import { GalleryHero } from "@/components/gallery-hero";
import { StoryHeroSlider } from "@/components/story-hero-slider";
import { SponsorHeroCarousel } from "@/components/sponsor-hero-carousel";
import { PropertyHero } from "@/components/property-hero";
import { NewsFreshness, PullToRefresh } from "@/components/refresh-news";

/** Live news feeds a manual/pull refresh re-reads on the homepage. */
const HOME_LIVE_KEYS: unknown[][] = [
  ["home", "posts"],
  ["wp", "posts", "city-news"],
  ["wp", "posts", "india-states", "home"],
];
import { CollectStatus } from "@/components/collect-status";
import { PropertyPromo } from "@/components/property-promo";
import { SmartImage } from "@/components/smart-image";


const TITLE = "Times Bay Area — Digest of newspapers & journals";
const DESC =
  "A daily digest of newspapers and journals for the Bay Area Telugu community: every headline credits its publisher and links to the original report.";
const HOME_URL = canonical("/");

/** Reserves every headline, source URL and image once across the whole homepage. */
function takeUnique<T extends Parameters<typeof contentDedupeKeys>[0]>(
  items: T[],
  seen: Set<string>,
  limit = items.length,
) {
  const result: T[] = [];
  for (const item of items) {
    const keys = contentDedupeKeys(item);
    if (keys.some((key) => seen.has(key))) continue;
    keys.forEach((key) => seen.add(key));
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}


/** Single snapshot read — no database, temple, politics or RSS calls. */
const homeQuery = queryOptions({
  queryKey: ["home", "posts"],
  queryFn: () => listPosts({ data: { perPage: 40, compact: true } }),
  // Home digest tracks the fast desks: fresh for 5 minutes, quiet background
  // poll every 15, and a re-read whenever a parked tab is focused again.
  staleTime: 5 * 60 * 1000,
  refetchInterval: 15 * 60 * 1000,
  refetchOnWindowFocus: true,
});

/**
 * Same feed the City News section shows, so the home digest and /category/city-news
 * always carry the identical stories and pictures.
 */
const cityNewsQuery = queryOptions({
  queryKey: ["wp", "posts", "city-news"],
  queryFn: () => listPosts({ data: { category: "city-news", perPage: 24, compact: true } }),
  staleTime: 5 * 60 * 1000,
  refetchInterval: 15 * 60 * 1000,
  refetchOnWindowFocus: true,
});

/**
 * Picture desk for the home page — same Gallery grid used in /category/gallery.
 * Kept on a short cache so newly collected star photos show up on the next visit
 * instead of sitting behind a half-hour snapshot.
 */
/** The 48-picture Glamour pocket is swapped for a fresh one three times a day. */
export const GALLERY_POCKET_MS = 8 * 60 * 60 * 1000;
/** Which 8-hour pocket we are in (same value on server and client). */
const currentPocket = () => Math.floor(Date.now() / GALLERY_POCKET_MS);

/** How many 48-photo windows of the folder the pockets walk through. */
const GALLERY_WINDOWS = 3;

/**
 * Wide pool used only by the full-size slots: a week of no-repeat rotation needs
 * far more than the 48 photos the grid shows. Loaded in the background, so it
 * never delays the first paint.
 */
const heroGalleryQuery = queryOptions({
  queryKey: ["wp", "posts", "gallery", "heroes"],
  queryFn: (): Promise<Article[]> =>
    listPosts({ data: { category: "gallery", perPage: 200, compact: true } }) as Promise<Article[]>,
  staleTime: GALLERY_POCKET_MS,
});


const galleryQueryFor = (pocket: number) =>
  queryOptions({
    // The pocket number is part of the key, so a brand new window of photos is
    // read three times a day while each pocket itself stays cached.
    queryKey: ["wp", "posts", "gallery", "home", pocket],
    queryFn: (): Promise<Article[]> =>
      listPosts({
        data: {
          category: "gallery",
          perPage: 48,
          compact: true,
          // Each pocket reads a different slice of the folder, so photos already
          // shown this week are not simply re-read as the newest 48 again.
          page: ((pocket % GALLERY_WINDOWS) + GALLERY_WINDOWS) % GALLERY_WINDOWS,
        },
      }) as Promise<Article[]>,
    staleTime: GALLERY_POCKET_MS,
  });



/**
 * Home-state desk: Telangana / Hyderabad and Andhra / Amaravati coverage,
 * including the property market there, shown alongside the Bay Area digest.
 */
const homeStatesQuery = queryOptions({
  queryKey: ["wp", "posts", "india-states", "home"],
  queryFn: () => listPosts({ data: { category: "india-news", perPage: 40, compact: true } }),
  staleTime: 5 * 60 * 1000,
  refetchInterval: 15 * 60 * 1000,
  refetchOnWindowFocus: true,
});

/** Community-submitted and editor-published items from the newsroom CMS. */
const communityQuery = queryOptions({
  queryKey: ["cms", "community", "home"],
  queryFn: () => listCommunityItems({ data: { limit: 8 } }),
  staleTime: 5 * 60 * 1000,
});

/** Published events from the newsroom CMS — these carry pictures. */
const cmsEventsQuery = queryOptions({
  queryKey: ["cms", "events", "home"],
  queryFn: () => listCommunityItems({ data: { kind: "event", limit: 8 } }),
  staleTime: 5 * 60 * 1000,
});


/** Pulled straight from temple websites — independent of the newsroom feed. */
const templeQuery = queryOptions({
  queryKey: ["temples", "announcements"],
  queryFn: () => listTempleAnnouncements(),
  staleTime: 30 * 60 * 1000,
});

/** City-hall and Indian political headlines, pulled from publisher feeds. */
const politicsQuery = queryOptions({
  queryKey: ["politics", "all"],
  queryFn: () => listPolitics(),
  staleTime: 30 * 60 * 1000,
});


/**
 * Shared empty / error surface: always says what happened and offers one
 * concrete way out instead of a dead end.
 */
function EmptyState({ title, note }: { title: string; note?: string }) {
  return (
    <div className="rise mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-ink">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {note ?? "Reload the digest, or browse a section from the menu."}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="press min-h-11 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
        >
          Reload digest
        </button>
        <Link
          to="/category/$category"
          params={{ category: "city-news" }}
          className="press inline-flex min-h-11 items-center rounded-full border border-border px-5 text-sm font-semibold text-ink"
        >
          Browse city news
        </Link>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    // Only the text digest blocks the first paint. The Glamour folder is warmed
    // in the background and streams into its own boundary afterwards.
    const pocket = currentPocket();
    await Promise.all([
      context.queryClient.ensureQueryData(homeQuery),
      context.queryClient.ensureQueryData(cityNewsQuery),
    ]);
    void context.queryClient.prefetchQuery(galleryQueryFor(pocket));
    return { pocket };
  },



  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: HOME_URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: HOME_URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: TITLE,
          description: DESC,
          url: HOME_URL,
        }),
      },
    ],
  }),
  component: Home,
  pendingComponent: () => (
    <div className="mx-auto max-w-3xl px-3 py-6">
      <div className="aspect-[4/3] w-full animate-pulse rounded-2xl bg-muted sm:aspect-[16/9]" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  ),
  errorComponent: () => <EmptyState title="Today's edition didn't load" />,
  notFoundComponent: () => (
    <EmptyState
      title="No stories yet"
      note="The digest refills as soon as the next collection run finishes."
    />
  ),
});


function Lead({ a }: { a: Article }) {
  return (
    <article>
      <Link to="/article/$slug" params={{ slug: a.slug }} className="lift block rounded-md">
        <div className="overflow-hidden rounded-md">
          <Thumb article={a} priority sizes="(max-width: 768px) 100vw, 720px" />
        </div>
        <h2 className="mt-2 text-[22px] font-bold leading-snug text-ink">{a.title}</h2>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.excerpt}</p>
        <p className="mt-1.5 flex flex-wrap items-center gap-2">
          <SourceChip article={a} />
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {a.categoryName} · {formatDate(a.date)}
          </span>
        </p>
      </Link>
      <StoryActions id={a.slug} title={a.title} url={`/article/${a.slug}`} context="lead" />
    </article>
  );
}

function Row({ a }: { a: Article }) {
  return (
    <article className="border-b border-border px-1 py-3 last:border-0">
      <Link to="/article/$slug" params={{ slug: a.slug }} className="lift block rounded-md">
        {/* Bigger picture first, then the story text underneath. */}
        <div className="overflow-hidden rounded">
          <Thumb article={a} sizes="(max-width: 768px) 100vw, 720px" />
        </div>
        <div className="mt-2">
          <h3 className="line-clamp-3 text-[16px] font-semibold leading-snug text-ink">
            {a.title}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-2">
            <SourceChip article={a} />
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {a.categoryName} · {formatDate(a.date)}
            </span>
          </p>
        </div>
      </Link>
      <StoryActions id={a.slug} title={a.title} url={`/article/${a.slug}`} context="card" />
    </article>
  );
}

/** Text-only stories run as tight snippets so the feed stays picture-led. */
function Snippet({ a }: { a: Article }) {
  return (
    <li className="border-b border-border py-2 last:border-0">
      <Link to="/article/$slug" params={{ slug: a.slug }} className="block">
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink">{a.title}</h3>
        {a.excerpt ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.excerpt}</p>
        ) : null}
        <p className="mt-1 flex flex-wrap items-center gap-2">
          <SourceChip article={a} />
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {formatDate(a.date)}
          </span>
        </p>
      </Link>
      <StoryActions id={a.slug} title={a.title} url={`/article/${a.slug}`} context="snippet" />
    </li>
  );
}


function Head({ children, more }: { children: React.ReactNode; more?: React.ReactNode }) {
  return (
    <h2 className="mb-1 flex items-baseline justify-between gap-2 border-b-2 border-primary pb-1 text-sm font-bold uppercase tracking-wide text-ink">
      <span>{children}</span>
      {more}
    </h2>
  );
}

function MoreTo({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="text-[11px] font-semibold normal-case tracking-normal text-primary underline"
    >
      {label}
    </Link>
  );
}

/** External or CMS link rows keep the same lean look as story rows. */
function LinkRow({
  href,
  title,
  meta,
  internal,
  image,
}: {
  href: string;
  title: string;
  meta?: string;
  internal?: boolean;
  image?: string | null;
}) {
  const picture = usableImage(image);
  const body = (
    <>
      {picture ? (
        <SmartImage
          src={picture}
          alt=""
          loading="lazy"
          decoding="async"
          optimizedWidth={480}
          sizes="(max-width: 768px) 100vw, 33vw"
          className="mb-2 aspect-[16/9] w-full rounded-md border border-border object-cover object-top"
        />
      ) : null}
      <h3 className="line-clamp-3 text-[15px] font-semibold leading-snug text-ink">{title}</h3>
      {meta ? (
        <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">{meta}</p>
      ) : null}
    </>
  );
  const cls = "lift block rounded-md border-b border-border px-1 py-3 last:border-0";
  return internal ? (
    <Link to={href} className={cls}>
      {body}
    </Link>
  ) : (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>
      {body}
    </a>
  );
}


/** Picture tile that opens the swipeable home gallery viewer. */
function GalleryTile({ article, onOpen }: { article: Article; onOpen: () => void }) {
  return (
    <figure className="lift m-0 rounded-md">
      <div className="relative">
        <button type="button" onClick={onOpen} className="block w-full text-left">
          <Thumb article={article} ratio="aspect-[3/4]" sizes="(max-width: 768px) 50vw, 200px" />
        </button>
        <PhotoActions article={article} tone="light" className="absolute right-1.5 top-1.5" />
      </div>
      <figcaption className="mt-1.5">
        <button type="button" onClick={onOpen} className="block w-full text-left">
          <p className="line-clamp-2 text-xs font-semibold leading-snug text-ink">{article.title}</p>
        </button>
        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <SourceChip article={article} />
          <RelativeDate iso={article.date} />
        </span>
      </figcaption>
    </figure>
  );
}

/** Pulse skeleton shown while the Glamour pocket streams in after first paint. */
function GallerySkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="aspect-[3/4] w-full animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}

/**
 * Every gallery-fed surface derives from the same pools. Kept in one memo so a
 * rotation tick never recomputes the dedupe/sort work for the whole page.
 */
function useGalleryPools(pocket: number) {
  const { data: galleryItems = [] } = useSuspenseQuery(galleryQueryFor(pocket));
  // Background-only: the wide hero pool loads after paint.
  const { data: heroItems = [] } = useQuery(heroGalleryQuery);
  const { favorites } = useFavoritePhotos();
  const { hidden, hiddenImages } = useHiddenPhotos();

  return useMemo(() => {
    // A disliked picture is gone for good: the same image URL is blocked even if
    // it is re-collected later under a different slug.
    const notDislikedPicture = (a: { slug: string; image?: string | null }) =>
      !hidden.includes(a.slug) && !(a.image && hiddenImages.includes(a.image));
    const galleryPool = takeUnique(galleryItems, new Set<string>(), 96)
      .filter(notDislikedPicture)
      .sort((a, b) => +new Date(b.date) - +new Date(a.date));
    const favoriteSlugs = new Set(favorites.map((f) => f.slug));
    const pinnedSlugs = new Set<string>();
    // Only pictures you liked stay pinned. Everything else shuffles.
    const pinned = galleryPool
      .filter((a) => favoriteSlugs.has(a.slug))
      .filter((a) => (pinnedSlugs.has(a.slug) ? false : pinnedSlugs.add(a.slug)))
      .slice(0, 2);
    const rotatable = galleryPool.filter((a) => !pinnedSlugs.has(a.slug));
    // The full-size heroes draw from the WHOLE Glamour folder, not just the six
    // tiles shown in the grid. Prefer the wide background pool (up to 200
    // photos) so a picture that ran this week is not re-shown.
    const widePool = heroItems.filter(notDislikedPicture);
    const heroPool = widePool.length
      ? widePool
      : galleryPool.length
        ? galleryPool
        : galleryItems.filter(notDislikedPicture).length
          ? galleryItems.filter(notDislikedPicture)
          : galleryItems;
    return { galleryPool, pinned, rotatable, heroPool };
  }, [galleryItems, heroItems, favorites, hidden, hiddenImages]);
}

/** One full-size Glamour slide inside the city feed; streams in on its own. */
function FeedGalleryHero({
  pocket,
  slot,
  onOpen,
  className = "",
}: {
  pocket: number;
  slot: number;
  onOpen: (index: number) => void;
  className?: string;
}) {
  const { heroPool } = useGalleryPools(pocket);
  return <GalleryHero items={heroPool} onOpen={onOpen} offset={slot} className={className} />;
}


/**
 * The Glamour grid owns its own shuffle: the minute tick re-renders these six
 * tiles only, never the whole digest. A backgrounded tab does no work.
 */
function GlamourGrid({ pocket }: { pocket: number }) {
  const { pinned, rotatable, heroPool } = useGalleryPools(pocket);
  const [galleryPage, setGalleryPage] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setGalleryPage((p) => p + 1);
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const tiles = useMemo(() => {
    const fillCount = Math.max(0, 6 - pinned.length);
    const start = rotatable.length ? (galleryPage * fillCount) % rotatable.length : 0;
    return [
      ...pinned,
      ...[...rotatable.slice(start), ...rotatable.slice(0, start)].slice(0, fillCount),
    ];
  }, [pinned, rotatable, galleryPage]);

  return (
    <>
      <div className="mb-3">
        <RefreshGalleryButton onRefreshed={() => setGalleryPage((p) => p + 1)} />
      </div>

      {tiles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No cinema pictures yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {tiles.map((a) => (
            <GalleryTile
              key={a.slug}
              article={a}
              onOpen={() =>
                setViewerIndex(Math.max(0, heroPool.findIndex((g) => g.slug === a.slug)))
              }
            />
          ))}
        </div>
      )}

      {heroPool.length > 0 && viewerIndex !== null && (
        <Suspense fallback={null}>
          <GalleryLightbox
            items={heroPool}
            index={viewerIndex}
            onIndexChange={setViewerIndex}
            onClose={() => setViewerIndex(null)}
          />
        </Suspense>
      )}
    </>
  );
}

function Home() {
  const { data: articles, dataUpdatedAt: homeUpdatedAt } = useSuspenseQuery(homeQuery);
  // Identical feed to /category/city-news so both screens carry the same stories.
  const { data: cityNews } = useSuspenseQuery(cityNewsQuery);
  const { pocket: loaderPocket } = Route.useLoaderData();
  // Same picture desk used in /category/gallery. The pocket of 48 pictures is
  // replaced three times a day (every 8 hours), which lets archived photos
  // rotate back in without extra reads.
  const [pocket, setPocket] = useState(loaderPocket);
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setPocket(currentPocket());
    }, 5 * 60_000);
    return () => window.clearInterval(id);
  }, []);

  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // Main story slot advances every 15 minutes. Starts at 0 so server and first
  // client render agree, then picks up the time-based slot after mount.
  const [primeSlot, setPrimeSlot] = useState(0);
  useEffect(() => {
    const current = () => Math.floor(Date.now() / PRIME_ROTATE_MS);
    setPrimeSlot(current());
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setPrimeSlot(current());
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);
  const { hidden } = useHiddenPhotos();

  // Fresh, non-blocking reads: these stream in after the snapshot first paint.
  const { data: communityItems = [] } = useQuery(communityQuery);
  const { data: cmsEvents = [] } = useQuery(cmsEventsQuery);
  const { data: indiaStates = [] } = useQuery(homeStatesQuery);
  const { data: templeFeeds = [] } = useQuery(templeQuery);
  const { data: politicsGroups = [] } = useQuery(politicsQuery);

  // One derivation pass for the whole digest: rotation ticks and photo state no
  // longer re-run the dedupe/classification work below.
  const derived = useMemo(() => {
    const homepageSeen = new Set<string>();
    // Disliked stories disappear for this reader too (editors delete them site-wide).
    const notDisliked = <T extends { slug: string }>(list: T[]) =>
      list.filter((a) => !hidden.includes(a.slug));
    const local = notDisliked(
      takeUnique(cityNews.length ? cityNews : articles.filter(isLocal), new Set<string>()),
    );
    // Prime slot leads with a Bay Area story: the strongest local stories are
    // ranked by popularity and the slot rotates through them every 15 minutes.
    const leadCandidates = notDisliked(
      [...local, ...articles].filter((a) => a.category !== "gallery"),
    );
    const bayPool = leadCandidates.filter(
      (a) => isBayArea(a.title) || isBayAreaSource(a.sourceUrl),
    );
    const looseBayPool = leadCandidates.filter(
      (a) => isBayArea(a.title, a.excerpt) && !classifyIndia(a.title, a.excerpt, a.sourceUrl),
    );
    const primePool = bayPool.length
      ? bayPool
      : looseBayPool.length
        ? looseBayPool
        : leadCandidates.filter((a) => !classifyIndia(a.title, a.excerpt, a.sourceUrl));
    const lead =
      pickRotatingPrime(primePool, primeSlot) ??
      pickPrimeStory(primePool) ??
      local[0] ??
      articles[0];

    if (!lead) return null;

    // Candidate pool for the curated hero slider: the lead first, then local Bay
    // Area stories, then the wider digest.
    const heroSliderPool = (() => {
      const seenSlugs = new Set<string>();
      return [lead, ...local, ...leadCandidates].filter((a) =>
        seenSlugs.has(a.slug) ? false : seenSlugs.add(a.slug),
      );
    })();

    // Prime slot: the hand-built banner holds it only while fresh; past its age
    // threshold the newest local story is promoted instead.
    const bannerFresh = isPrimeBannerFresh();
    const localRest = local.filter((a) => a.slug !== lead.slug).slice(0, 8);
    const localPictureStories = localRest.filter((a) => a.image);
    takeUnique([lead, ...localRest], homepageSeen);

    const uniqueCommunity = takeUnique(communityItems, homepageSeen, 8);
    const uniqueCmsEvents = takeUnique(cmsEvents, homepageSeen, 8);

    const events = upcomingEvents().slice(0, 5);
    // Feeds sometimes repeat the same link (or point at the site root), which both
    // duplicated rows and tripped React's key warning.
    const uniqueBy = <T,>(list: T[], key: (item: T) => string) => {
      const seen = new Set<string>();
      return list.filter((item) => {
        const k = key(item);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    };
    const templeNews = uniqueBy(
      templeFeeds.flatMap((f) => f.announcements.map((a) => ({ ...a, temple: f.name }))),
      (a) => `${a.temple}|${a.title}`,
    ).slice(0, 6);
    const politics = uniqueBy(
      politicsGroups.flatMap((g) => g.stories.slice(0, 2)),
      (s) => s.title,
    ).slice(0, 6);
    const uniqueTemples = takeUnique(templeNews, homepageSeen, 6);
    const uniquePolitics = takeUnique(politics, homepageSeen, 6);
    const uniqueFallbackEvents = takeUnique(events, homepageSeen, 5);
    const homeStates = takeUnique(
      indiaStates.filter((a) => a.category === "india-telangana" || a.category === "india-andhra"),
      homepageSeen,
      8,
    );
    // "Happening soon": compact, chronological, utility-first. Upcoming events only
    // (an event drops off after its own day) and each row carries its classified
    // label (Temple / Spiritual, Community Event, FunZone, …).
    const happeningSoon = [
      ...uniqueCmsEvents
        .filter((e) => isUpcoming(e.event_start))
        .map((e) => {
          const c = classifyItem({
            title: e.title,
            summary: e.summary,
            kind: e.kind,
            eventStart: e.event_start,
          });
          return {
            key: `cms-${e.id}`,
            title: e.title,
            start: e.event_start as string,
            city: e.city ?? c.tags[0] ?? "",
            when: whenLabel(e.event_start as string),
            label: c.label,
          };
        }),
      ...uniqueFallbackEvents.map((e) => {
        const c = classifyItem({ title: e.title, eventStart: e.start });
        return {
          key: `local-${e.id}`,
          title: e.title,
          start: e.start,
          city: e.city,
          when: whenLabel(e.start),
          label: c.label,
        };
      }),
    ]
      .sort((a, b) => +new Date(a.start) - +new Date(b.start))
      .slice(0, 6);

    const more = takeUnique(articles, homepageSeen, 12);

    return {
      lead,
      heroSliderPool,
      bannerFresh,
      localRest,
      localPictureStories,
      uniqueCommunity,
      uniqueTemples,
      uniquePolitics,
      homeStates,
      happeningSoon,
      more,
    };
  }, [
    articles,
    cityNews,
    communityItems,
    cmsEvents,
    indiaStates,
    templeFeeds,
    politicsGroups,
    hidden,
    primeSlot,
  ]);

  if (!derived) {
    return <EmptyState title="No stories yet" />;
  }

  const {
    lead,
    heroSliderPool,
    bannerFresh,
    localRest,
    localPictureStories,
    uniqueCommunity,
    uniqueTemples,
    uniquePolitics,
    homeStates,
    happeningSoon,
    more,
  } = derived;

  return (
    <div className="rise mx-auto max-w-6xl px-3 py-3">
      <h1 className="sr-only">Times Bay Area — digest of newspapers and journals</h1>
      <PullToRefresh queryKeys={HOME_LIVE_KEYS} />

      <div className="mx-auto max-w-3xl">
        <div className="mb-3 rounded-md border border-border bg-surface-tint px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
            Digest from sources
          </p>
          <DigestNote className="mt-0.5" />
          <CollectStatus mode="all" className="mt-2" />
          <NewsFreshness
            className="mt-2"
            queryKeys={HOME_LIVE_KEYS}
            updatedAt={homeUpdatedAt}
          />
        </div>

        {/* Compact editorial hero: a curated 4–5 story slider (6s cross-fade),
            sized so the next section is visible without a full-screen scroll. */}
        <StoryHeroSlider articles={heroSliderPool} />

        {/* Sponsor carousel: CREDAI banner first, then the vertical anniversary
            edition features. */}
        <SponsorHeroCarousel className="mt-4" />

        {/* The hand-built prime feature keeps its slot only while fresh. */}
        {bannerFresh ? <div className="mt-4"><HousingHero /></div> : null}
      </div>


      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[1fr_280px] lg:grid-cols-[1fr_340px]">
        <section>
          <Head more={<MoreTo to="/category/city-news" label="All city news" />}>Bay Area digest</Head>
          {bannerFresh ? <Lead a={lead} /> : null}
          <div className={bannerFresh ? "mt-4" : ""}>
            {localPictureStories.map((a, i) => {
                // Hero-size Glamour slides inside the city feed: one after the
                // third story, then the ten-items-apart pair. A property
                // hero-size slide follows the first Glamour slide.
                const heroSlot = i === 2 ? 2 : i === 9 ? 0 : i === 19 ? 1 : null;

                return (
                  <div key={a.slug}>
                    <Row a={a} />
                    {heroSlot !== null ? (
                      <Suspense fallback={null}>
                        <FeedGalleryHero
                          pocket={pocket}
                          slot={heroSlot}
                          onOpen={setViewerIndex}
                          className="my-4"
                        />
                      </Suspense>
                    ) : null}
                    {i === 2 ? <PropertyHero className="my-4" /> : null}
                    {/* Compact property-show module, four items into the feed. */}
                    {i === 3 ? <PropertyPromo className="my-4" /> : null}
                  </div>
                );
              })}


            {/* Short feed day: still show the two slides, ten items apart is not
                possible so they follow the available stories. */}
            {localPictureStories.length < 10 ? (
              <>
                <PropertyPromo className="my-4" />
                <Suspense fallback={null}>
                  <FeedGalleryHero
                    pocket={pocket}
                    slot={0}
                    onOpen={setViewerIndex}
                    className="my-4"
                  />
                </Suspense>
              </>
            ) : null}
            {localPictureStories.length >= 10 && localPictureStories.length < 20 ? (
              <Suspense fallback={null}>
                <FeedGalleryHero
                  pocket={pocket}
                  slot={1}
                  onOpen={setViewerIndex}
                  className="my-4"
                />
              </Suspense>
            ) : null}



          </div>
          {localRest.some((a) => !a.image) ? (
            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                In brief
              </p>
              <ul>
                {localRest.filter((a) => !a.image).map((a) => (
                  <Snippet key={a.slug} a={a} />
                ))}
              </ul>
            </div>
          ) : null}
        </section>


        <section>
          <Head more={<MoreTo to="/category/india-news" label="All India news" />}>
            Telangana &amp; Andhra
          </Head>
          {homeStates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading home-state news…</p>
          ) : (
            <div>
              {homeStates.map((a) => (
                <Row key={a.slug} a={a} />
              ))}
            </div>
          )}
        </section>

        <section>
          <Head more={<MoreTo to="/category/gallery" label="All pictures" />}>Glamour</Head>
          <Suspense fallback={<GallerySkeleton />}>
            <GlamourGrid pocket={pocket} />
          </Suspense>
        </section>
      </div>

      <div className="mx-auto max-w-3xl">
        {uniqueCommunity.length > 0 && (
          <section className="mt-5">
            <Head more={<MoreTo to="/connect" label="Community" />}>From the community</Head>
            {uniqueCommunity.map((item) => (
              <LinkRow
                key={item.id}
                href={item.link_url ?? "/connect"}
                internal={!item.link_url || item.link_url.startsWith("/")}
                title={item.title}
                image={item.image_url}
                meta={[item.city, item.kind].filter(Boolean).join(" · ")}
              />
            ))}
          </section>
        )}

        {happeningSoon.length > 0 && (
          <section className="mt-5">
            <Head more={<MoreTo to="/events" label="All events →" />}>Happening soon</Head>
            <ul className="divide-y divide-border">
              {happeningSoon.map((e) => (
                <li key={e.key}>
                  <Link
                    to="/events"
                    className="lift flex items-center gap-3 rounded-md px-1 py-2.5"
                  >
                    <span className="flex w-14 shrink-0 flex-col items-center rounded-md border border-border bg-surface-tint py-1">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-primary">
                        {new Date(e.start).toLocaleDateString(undefined, { month: "short" })}
                      </span>
                      <span className="text-lg font-extrabold leading-none text-ink">
                        {new Date(e.start).getDate()}
                      </span>
                    </span>
                    <span className="min-w-0">
                      <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink">
                        {e.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] uppercase tracking-wide text-muted-foreground">
                        {[e.when, e.city, e.label].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}


        {uniqueTemples.length > 0 && (
          <section className="mt-5">
            <Head more={<MoreTo to="/temples" label="All temples" />}>Temple announcements</Head>
            {uniqueTemples.map((a, i) => (
              <LinkRow key={`${a.url}-${i}`} href={a.url} title={a.title} meta={a.temple} />
            ))}
          </section>
        )}

        {uniquePolitics.length > 0 && (
          <section className="mt-5">
            <Head more={<MoreTo to="/politics" label="More politics" />}>Politics</Head>
            {uniquePolitics.map((s, i) => (
              <LinkRow
                key={`${s.url}-${i}`}
                href={s.url}
                title={s.title}
                meta={[s.publisher, s.date ? formatDate(s.date) : ""].filter(Boolean).join(" · ")}
              />
            ))}
          </section>
        )}

        <section className="mt-5">
          <Head>More news</Head>
          {more.map((a) => (
            <Row key={a.slug} a={a} />
          ))}
        </section>
      </div>

      {/* Full-size feed slides open the same viewer; it owns its own copy of the
          pool inside the gallery boundary. */}
      {viewerIndex !== null ? (
        <Suspense fallback={null}>
          <FeedViewer pocket={pocket} index={viewerIndex} onIndexChange={setViewerIndex} onClose={() => setViewerIndex(null)} />
        </Suspense>
      ) : null}
    </div>
  );
}

/** Viewer for the in-feed full-size slides. */
function FeedViewer({
  pocket,
  index,
  onIndexChange,
  onClose,
}: {
  pocket: number;
  index: number;
  onIndexChange: (i: number | null) => void;
  onClose: () => void;
}) {
  const { heroPool } = useGalleryPools(pocket);
  if (heroPool.length === 0) return null;
  return (
    <GalleryLightbox
      items={heroPool}
      index={index}
      onIndexChange={onIndexChange}
      onClose={onClose}
    />
  );
}


