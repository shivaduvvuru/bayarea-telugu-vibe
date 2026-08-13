import { useState } from "react";
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
import { dedupeKey } from "@/lib/dedupe";
import { HousingHero } from "@/components/housing-hero";
import { DigestNote, SourceChip } from "@/components/source-credit";
import { RelativeDate, Thumb } from "@/components/news";
import { GalleryLightbox } from "@/components/gallery-lightbox";
import { PhotoActions } from "@/components/photo-actions";

const TITLE = "Bay Area Telugu Times — Digest of newspapers & journals";
const DESC =
  "A daily digest of newspapers and journals for the Bay Area Telugu community: every headline credits its publisher and links to the original report.";
const HOME_URL = canonical("/");

function contentKeys(item: {
  title?: string | null;
  sourceUrl?: string | null;
  url?: string | null;
  link_url?: string | null;
  image?: string | null;
  image_url?: string | null;
}) {
  const title = dedupeKey(item.title ?? "");
  const url = item.sourceUrl ?? item.link_url ?? item.url;
  const image = usableImage(item.image ?? item.image_url);
  return [
    title ? `t:${title}` : "",
    url ? `u:${url.split("?")[0]?.replace(/\/$/, "").toLowerCase()}` : "",
    image ? `i:${image.split("?")[0]?.toLowerCase()}` : "",
  ].filter(Boolean);
}

/** Reserves every headline, source URL and image once across the whole homepage. */
function takeUnique<T extends Parameters<typeof contentKeys>[0]>(
  items: T[],
  seen: Set<string>,
  limit = items.length,
) {
  const result: T[] = [];
  for (const item of items) {
    const keys = contentKeys(item);
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
  staleTime: 30 * 60 * 1000,
});

/**
 * Same feed the City News section shows, so the home digest and /category/city-news
 * always carry the identical stories and pictures.
 */
const cityNewsQuery = queryOptions({
  queryKey: ["wp", "posts", "city-news"],
  queryFn: () => listPosts({ data: { category: "city-news", perPage: 24, compact: true } }),
  staleTime: 30 * 60 * 1000,
});

/** Picture desk for the home page — same Gallery grid used in /category/gallery. */
const galleryQuery = queryOptions({
  queryKey: ["wp", "posts", "gallery"],
  queryFn: () => listPosts({ data: { category: "gallery", perPage: 6, compact: true } }),
  staleTime: 30 * 60 * 1000,
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


export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(homeQuery),
      context.queryClient.ensureQueryData(cityNewsQuery),
      context.queryClient.ensureQueryData(galleryQuery),
    ]);
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
  errorComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-ink">Today's edition didn't load</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Please refresh, or browse sections from the menu below.
      </p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-ink">No stories yet</h1>
    </div>
  ),
});


function Lead({ a }: { a: Article }) {
  return (
    <Link to="/article/$slug" params={{ slug: a.slug }} className="block">
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
  );
}

function Row({ a }: { a: Article }) {
  return (
    <Link
      to="/article/$slug"
      params={{ slug: a.slug }}
      className="block border-b border-border py-3 last:border-0"
    >
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
  );
}

function Head({ children, more }: { children: string; more?: React.ReactNode }) {
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
        <img
          src={picture}
          alt=""
          loading="lazy"
          decoding="async"
          className="mb-2 aspect-[16/9] w-full rounded-md border border-border object-cover object-top"
        />
      ) : null}
      <h3 className="line-clamp-3 text-[15px] font-semibold leading-snug text-ink">{title}</h3>
      {meta ? (
        <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">{meta}</p>
      ) : null}
    </>
  );
  const cls = "block border-b border-border py-3 last:border-0";
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
    <figure className="m-0">
      <div className="relative">
        <button type="button" onClick={onOpen} className="block w-full text-left">
          <Thumb article={article} ratio="aspect-[3/4]" sizes="(max-width: 768px) 50vw, 180px" />
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

function Home() {
  const { data: articles } = useSuspenseQuery(homeQuery);
  // Identical feed to /category/city-news so both screens carry the same stories.
  const { data: cityNews } = useSuspenseQuery(cityNewsQuery);
  // Same picture desk used in /category/gallery.
  const { data: galleryItems = [] } = useSuspenseQuery(galleryQuery);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  // Fresh, non-blocking reads: these stream in after the snapshot first paint.
  const { data: communityItems = [] } = useQuery(communityQuery);
  const { data: cmsEvents = [] } = useQuery(cmsEventsQuery);
  const { data: templeFeeds = [] } = useQuery(templeQuery);
  const { data: politicsGroups = [] } = useQuery(politicsQuery);

  const homepageSeen = new Set<string>();
  const local = takeUnique(cityNews.length ? cityNews : articles.filter(isLocal), new Set<string>());
  const lead = local[0] ?? articles[0];

  if (!lead) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-ink">No stories yet</h1>
      </div>
    );
  }

  // The lead has already been reserved by the local pass. Every later section
  // uses the same set, preventing a renamed/cross-posted story or reused photo
  // from appearing again under More news, Community, Events or Gallery.
  const localRest = local.filter((a) => a.slug !== lead.slug).slice(0, 8);
  takeUnique([lead, ...localRest], homepageSeen);
  const uniqueGallery = takeUnique(galleryItems, homepageSeen, 6);
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
  const more = takeUnique(articles, homepageSeen, 12);

  return (
    <div className="mx-auto max-w-6xl px-3 py-3">
      <h1 className="sr-only">Bay Area Telugu Times — digest of newspapers and journals</h1>

      <div className="mx-auto max-w-3xl">
        <div className="mb-3 rounded-md border border-border bg-surface-tint px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
            Digest from sources
          </p>
          <DigestNote className="mt-0.5" />
        </div>

        <HousingHero />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[1fr_280px] lg:grid-cols-[1fr_340px]">
        <section>
          <Head more={<MoreTo to="/category/city-news" label="All city news" />}>Bay Area digest</Head>
          <Lead a={lead} />
          <div className="mt-4">
            {localRest.map((a) => (
              <Row key={a.slug} a={a} />
            ))}
          </div>
        </section>

        <section>
          <Head more={<MoreTo to="/category/gallery" label="All pictures" />}>Cinema gallery</Head>
          {uniqueGallery.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cinema pictures yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {uniqueGallery.map((a, i) => (
                <GalleryTile key={a.slug} article={a} onOpen={() => setViewerIndex(i)} />
              ))}
            </div>
          )}
        </section>
      </div>

      {uniqueGallery.length > 0 && viewerIndex !== null && (
        <GalleryLightbox
          items={uniqueGallery}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}

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

        {(uniqueCmsEvents.length > 0 || events.length > 0) && (
          <section className="mt-5">
            <Head more={<MoreTo to="/events" label="All events" />}>Upcoming events</Head>
            {uniqueCmsEvents.length > 0
              ? uniqueCmsEvents.map((e) => (
                  <LinkRow
                    key={e.id}
                    href={e.link_url && !e.link_url.startsWith("/") ? e.link_url : "/events"}
                    internal={!e.link_url || e.link_url.startsWith("/")}
                    title={e.title}
                    image={e.image_url}
                    meta={[e.city, e.event_start ? formatDate(e.event_start) : e.venue]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                ))
              : uniqueFallbackEvents.map((e) => (
                  <LinkRow
                    key={e.id}
                    href="/events"
                    internal
                    title={e.title}
                    meta={`${e.city} · ${formatDate(e.start)}`}
                  />
                ))}
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
    </div>
  );
}

