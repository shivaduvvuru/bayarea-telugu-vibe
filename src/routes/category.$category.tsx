import { useEffect, useState } from "react";
import { isChunkLoadError, recoverFromChunkError } from "@/lib/chunk-reload";

import { Heart } from "lucide-react";
import { canonical } from "@/lib/site";
import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { categoryBySlug } from "@/lib/content";
import { SectionHeading, StoryCard, ListRow } from "@/components/news";
import { DigestNote } from "@/components/source-credit";
import { GalleryLightbox } from "@/components/gallery-lightbox";
import { RefreshGalleryButton } from "@/components/refresh-gallery-button";
import { GalleryDualHero } from "@/components/gallery-dual-hero";
import { GalleryTile, CityNewsGlamourSlide } from "@/components/category-tiles";
import { useHiddenPhotos } from "@/lib/photo-favorites";
import { NewsFreshness, PullToRefresh } from "@/components/refresh-news";
import { CityHeadlineBlock, cityHeadlineQuery } from "@/components/city-headline-hero";
import { SyndicatedNewsBlock } from "@/components/syndicated-news-block";
import { listSyndicatedStories } from "@/lib/syndicated.functions";
import { LIVE_DESKS, mixInto, postsQuery, isTempleArticle } from "@/lib/category-query";
import { TempleWeekStrip } from "@/components/temple-week-strip";
import { useGlamourShown } from "@/lib/use-glamour-shown";

const syndicatedStoriesQuery = queryOptions({
  queryKey: ["syndicated-stories", "new-india-abroad"],
  queryFn: () => listSyndicatedStories(),
  staleTime: 10 * 60 * 1000,
});




export const Route = createFileRoute("/category/$category")({
  // Sections that have a purpose-built page on this site rather than a WP feed.
  beforeLoad: ({ params }) => {
    const dedicated: Record<string, string> = {
      temples: "/temples",
      political: "/politics",
      "events-community": "/events",
    };
    const to = dedicated[params.category];
    if (to) throw redirect({ to, replace: true });
    // Micro-drama is now part of the Cinema/OTT desk.
    if (params.category === "micro-drama") {
      throw redirect({
        to: "/category/$category",
        params: { category: "cinema" },
        replace: true,
      });
    }
  },
  loader: async ({ params, context }) => {
    const cat = categoryBySlug(params.category);
    if (!cat) throw notFound();
    // Independent reads start together so City News does not pay a second round trip.
    const [, headline] = await Promise.all([
      context.queryClient.ensureQueryData(postsQuery(cat.slug)),
      cat.slug === "city-news"
        ? context.queryClient.ensureQueryData(cityHeadlineQuery)
        : Promise.resolve(null),
      cat.slug === "city-news"
        ? context.queryClient.ensureQueryData(syndicatedStoriesQuery)
        : Promise.resolve(null),
    ]);
    return { cat, headline: headline ?? null };
  },

  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Unavailable" }, { name: "robots", content: "noindex" }] };
    }
    const title = `${loaderData.cat.en} — Times Bay Area`;
    const description = `${loaderData.cat.en} coverage for the Bay Area Indian community.`;
    const url = canonical(`/category/${loaderData.cat.slug}`);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  errorComponent: CategoryError,

  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-ink">Section not found</h1>
    </div>
  ),
  component: CategoryPage,
});

/**
 * A new deploy retires the old hashed chunk for this route, so an open tab's
 * lazy import can 404. That is recoverable: reload once and the section loads.
 */
function CategoryError({ error, reset }: { error: Error; reset: () => void }) {
  const stale = isChunkLoadError(error);
  useEffect(() => {
    recoverFromChunkError(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center" role="alert">
      <p className="text-sm text-muted-foreground">
        {stale ? "Loading the latest version of this section…" : error.message}
      </p>
      {stale ? null : (
        <button
          type="button"
          onClick={reset}
          className="press mt-4 min-h-11 rounded-full border border-border px-6 text-sm font-semibold text-ink hover:border-primary hover:text-primary"
        >
          Try again
        </button>
      )}
    </div>
  );
}





function CategoryPage() {
  const { cat, headline } = Route.useLoaderData();
  const { data: allArticles, dataUpdatedAt } = useSuspenseQuery(postsQuery(cat.slug));
  const { data: syndicatedStories } = useQuery({ ...syndicatedStoriesQuery, enabled: cat.slug === "city-news" });
  const { hidden, hiddenImages } = useHiddenPhotos();
  const isCity = cat.slug === "city-news";
  const { data: cinemaMix = [] } = useQuery({ ...postsQuery("cinema"), enabled: isCity });
  const { data: indiaMix = [] } = useQuery({ ...postsQuery("india-news"), enabled: isCity });
  // Disliked pictures are dropped from the picture desk — by slug and by picture
  // URL, so a re-collected copy of the same photo never comes back.
  const articles =
    cat.slug === "gallery"
      ? allArticles.filter(
          (a) => !hidden.includes(a.slug) && !(a.image && hiddenImages.includes(a.image)),
        )
      : isCity
        ? mixInto(
            // Temple coverage in City News is handled by the week-ahead strip, so
            // stray/older temple stories never appear in the local scroll.
            allArticles.filter((a) => !isTempleArticle(a)),
            // Alternate cinema and India guests so neither desk dominates.
            cinemaMix.flatMap((c, i) => (indiaMix[i] ? [c, indiaMix[i]!] : [c])),
          )
        : allArticles;

  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  // Only the first screenful of cards is rendered (and its images requested);
  // the rest arrives on demand instead of on first paint.
  const pageSize = cat.slug === "gallery" ? 16 : 12;
  const [limit, setLimit] = useState(pageSize);
  const shown = articles.slice(0, limit);
  // Persist "last shown" for the Glamour pictures actually on screen.
  useGlamourShown(
    cat.slug === "gallery" ? shown.map((a) => a.slug) : [],
    cat.slug === "gallery",
  );
  const live = LIVE_DESKS.includes(cat.slug);
  const liveKeys = [["wp", "posts", cat.slug]];


  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {live ? <PullToRefresh queryKeys={liveKeys} /> : null}
      <h1 className="text-3xl font-bold text-ink">
        {cat.en}
      </h1>
      <p className="te-text mt-1 text-sm font-medium text-muted-foreground">{cat.te}</p>
      <DigestNote className="mt-2 max-w-2xl" />
      {live ? (
        <NewsFreshness className="mt-3" queryKeys={liveKeys} updatedAt={dataUpdatedAt} />
      ) : null}
      {cat.slug === "gallery" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            to="/favorites"
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold text-ink hover:border-primary hover:text-primary"
          >
            <Heart className="h-3.5 w-3.5" aria-hidden /> Saved photos
          </Link>
          <RefreshGalleryButton />
        </div>
      ) : null}


      {cat.children?.length ? (
        <nav
          className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible"
          aria-label={`${cat.en} sections`}
        >
          {cat.children.map((c) => (
            <Link
              key={c.slug}
              to="/category/$category"
              params={{ category: c.slug }}
              className="shrink-0 rounded-full border border-border px-3 py-1 text-xs font-semibold text-ink hover:border-primary"
            >
              {c.en}
            </Link>
          ))}
        </nav>
      ) : null}
      <div className="mt-6">
        {cat.slug === "city-news" ? <CityHeadlineBlock trending={articles} initial={headline} /> : null}
        {cat.slug === "city-news" ? <SyndicatedNewsBlock stories={syndicatedStories ?? []} /> : null}
        {cat.slug === "city-news" ? <TempleWeekStrip /> : null}
        {cat.slug === "gallery" && articles.length > 0 ? (
          <GalleryDualHero items={articles} onOpen={(i) => setViewerIndex(i)} />
        ) : null}



        <SectionHeading
          te={cat.slug === "gallery" ? "సినిమా ఫొటోలు" : "కథనాలు"}
          en={cat.slug === "gallery" ? "Cinema pictures" : "Stories"}
        />
        {articles.length === 0 ? (
          <p className="text-muted-foreground">
            {cat.slug === "gallery"
              ? "No cinema pictures in the digest yet."
              : "No stories published in this section yet."}
          </p>

        ) : cat.slug !== "gallery" ? (
          // Illustrated reporting leads every section; text-only stories are
          // collected underneath as short snippets instead of empty cards.

          <>
            {(() => {
              const picture = shown.filter((a) => a.image);
              // Two hero-size Glamour slides only, ten news items apart.
              const chunks = [picture.slice(0, 10), picture.slice(10, 20), picture.slice(20)];
              return chunks.map((chunk, ci) =>
                chunk.length ? (
                  <div key={ci}>
                    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                      {chunk.map((a) => (
                        <StoryCard key={a.id} article={a} />
                      ))}
                    </div>
                    {cat.slug === "city-news" && ci < 2 ? (
                      <CityNewsGlamourSlide slot={ci} />
                    ) : null}
                  </div>
                ) : null,
              );
            })()}
            {shown.some((a) => !a.image) ? (
              <div className="mt-10">
                <SectionHeading te="క్లుప్తంగా" en="In brief" />
                <ul className="grid gap-x-8 sm:grid-cols-2">
                  {shown.filter((a) => !a.image).map((a) => (
                    <ListRow key={a.id} article={a} />
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((a, i) => (
              <GalleryTile key={a.id} article={a} onOpen={() => setViewerIndex(i)} />
            ))}
          </div>

        )}
        {shown.length < articles.length ? (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => setLimit((n) => n + pageSize)}
              className="press min-h-11 rounded-full border border-border px-6 text-sm font-semibold text-ink hover:border-primary hover:text-primary"
            >
              Load more
            </button>
          </div>
        ) : null}

      </div>

      {cat.slug === "gallery" && viewerIndex !== null && (
        <GalleryLightbox
          items={articles}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </div>
  );
}
