import { useState } from "react";
import { Heart } from "lucide-react";
import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { categoryBySlug } from "@/lib/content";
import { listPosts } from "@/lib/content.functions";
import { SectionHeading, StoryCard, Thumb, RelativeDate, ListRow } from "@/components/news";
import { DigestNote, SourceChip } from "@/components/source-credit";
import { GalleryLightbox } from "@/components/gallery-lightbox";
import { RefreshGalleryButton } from "@/components/refresh-gallery-button";

import { PhotoActions } from "@/components/photo-actions";
import { useHiddenPhotos } from "@/lib/photo-favorites";

import type { Article } from "@/lib/content";

/** Picture-desk tile used by the Gallery section — opens the swipeable viewer. */
function GalleryTile({ article, onOpen }: { article: Article; onOpen: () => void }) {
  return (
    <figure className="m-0">
      <div className="relative">
        <button type="button" onClick={onOpen} className="block w-full text-left">
          <Thumb article={article} ratio="aspect-[3/4]" sizes="(max-width: 768px) 50vw, 33vw" />
        </button>
        <PhotoActions article={article} tone="light" className="absolute right-2 top-2" />
      </div>
      <figcaption className="mt-2">
        <button type="button" onClick={onOpen} className="block w-full text-left">
          <p className="line-clamp-2 text-sm font-semibold leading-snug headline-link">
            {article.title}
          </p>
        </button>
        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <SourceChip article={article} />
          <RelativeDate iso={article.date} />
        </span>
      </figcaption>
    </figure>
  );
}

const postsQuery = (category: string) =>
  queryOptions({
    // Gallery is a picture desk: show a much deeper set so repeat visits keep
    // finding different photos instead of the same newest handful.
    queryKey: ["wp", "posts", category],
    queryFn: () =>
      listPosts({ data: { category, perPage: category === "gallery" ? 60 : 24 } }),
    ...(category === "gallery"
      ? { staleTime: 60_000, refetchOnMount: "always" as const }
      : {}),
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
  },
  loader: async ({ params, context }) => {
    const cat = categoryBySlug(params.category);
    if (!cat) throw notFound();
    await context.queryClient.ensureQueryData(postsQuery(cat.slug));
    return { cat };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Unavailable" }, { name: "robots", content: "noindex" }] };
    }
    const title = `${loaderData.cat.en} — Bay Area Telugu Times`;
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
  const { data: allArticles } = useSuspenseQuery(postsQuery(cat.slug));
  const { hidden } = useHiddenPhotos();
  // Disliked pictures are dropped from the picture desk.
  const articles =
    cat.slug === "gallery" ? allArticles.filter((a) => !hidden.includes(a.slug)) : allArticles;
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold text-ink">
        {cat.slug === "gallery" ? {cat.en} : cat.en}
      </h1>
      <p className="te-text mt-1 text-sm font-medium text-muted-foreground">{cat.te}</p>
      <DigestNote className="mt-2 max-w-2xl" />
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

        ) : cat.slug === "city-news" ? (
          // Illustrated local reporting leads the page; text-only stories are
          // collected underneath as short snippets instead of empty cards.
          <>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {articles.filter((a) => a.image).map((a) => (
                <StoryCard key={a.id} article={a} />
              ))}
            </div>
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
