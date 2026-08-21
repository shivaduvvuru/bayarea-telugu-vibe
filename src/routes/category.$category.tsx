import { useState } from "react";
import { Heart } from "lucide-react";
import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
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
import { LIVE_DESKS, mixInto, postsQuery } from "@/lib/category-query";


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
    await context.queryClient.ensureQueryData(postsQuery(cat.slug));
    if (cat.slug === "city-news") {
      await context.queryClient.ensureQueryData(cityHeadlineQuery);
    }
    return { cat };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Unavailable" }, { name: "robots", content: "noindex" }] };
    }
    const title = `${loaderData.cat.en} — Times Bay Area`;
    const description = `${loaderData.cat.en} coverage for the Bay Area Telugu community.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center" role="alert">
      <p className="text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-ink">Section not found</h1>
    </div>
  ),
  component: CategoryPage,
});



function CategoryPage() {
  const { cat } = Route.useLoaderData();
  const { data: allArticles, dataUpdatedAt } = useSuspenseQuery(postsQuery(cat.slug));
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
            allArticles,
            // Alternate cinema and India guests so neither desk dominates.
            cinemaMix.flatMap((c, i) => (indiaMix[i] ? [c, indiaMix[i]!] : [c])),
          )
        : allArticles;

  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
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
        {cat.slug === "city-news" ? <CityHeadlineBlock trending={articles} /> : null}
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

        ) : cat.slug === "city-news" || cat.slug === "micro-drama" ? (
          // Illustrated local reporting leads the page; text-only stories are
          // collected underneath as short snippets instead of empty cards.
          <>
            {(() => {
              const picture = articles.filter((a) => a.image);
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
            {articles.some((a) => !a.image) ? (
              <div className="mt-10">
                <SectionHeading te="క్లుప్తంగా" en="In brief" />
                <ul className="grid gap-x-8 sm:grid-cols-2">
                  {articles.filter((a) => !a.image).map((a) => (
                    <ListRow key={a.id} article={a} />
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : (
          <div
            className={
              cat.slug === "gallery"
                ? "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
                : "grid gap-8 sm:grid-cols-2 lg:grid-cols-3"
            }
          >
            {articles.map((a, i) =>
              cat.slug === "gallery" ? (
                <GalleryTile key={a.id} article={a} onOpen={() => setViewerIndex(i)} />
              ) : (
                <StoryCard key={a.id} article={a} />
              ),
            )}
          </div>
        )}
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
