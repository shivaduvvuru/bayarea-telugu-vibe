import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { categoryBySlug } from "@/lib/content";
import { listPosts } from "@/lib/content.functions";
import { SectionHeading, StoryCard } from "@/components/news";
import { DigestNote } from "@/components/source-credit";

const postsQuery = (category: string) =>
  queryOptions({
    queryKey: ["wp", "posts", category],
    queryFn: () => listPosts({ data: { category, perPage: 24 } }),
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
  const { data: articles } = useSuspenseQuery(postsQuery(cat.slug));
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold text-ink">{cat.en}</h1>
      <p className="te-text mt-1 text-sm font-medium text-muted-foreground">{cat.te}</p>
      <DigestNote className="mt-2 max-w-2xl" />
      <div className="mt-6">
        <SectionHeading te="కథనాలు" en="Stories" />
        {articles.length === 0 ? (
          <p className="text-muted-foreground">No stories published in this section yet.</p>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <StoryCard key={a.id} article={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
