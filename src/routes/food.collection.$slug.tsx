import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { fetchFoodCollection } from "@/lib/food.functions";
import { RestaurantCard } from "@/components/food/restaurant-card";

export const Route = createFileRoute("/food/collection/$slug")({
  loader: async ({ params }) => {
    const data = await fetchFoodCollection({ data: { slug: params.slug } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Collection unavailable" }, { name: "robots", content: "noindex" }] };
    }
    const title = `${loaderData.collection.title} | Times Bay Area Food`;
    const desc =
      loaderData.collection.description ??
      `${loaderData.collection.title} — an editor-picked Bay Area restaurant collection.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc.slice(0, 155) },
        { property: "og:title", content: title },
        { property: "og:description", content: desc.slice(0, 155) },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  errorComponent: ({ error }) => (
    <p role="alert" className="mx-auto max-w-3xl px-4 py-10 text-sm text-destructive">
      {error.message}
    </p>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-lg font-bold text-ink">That collection is not available</h1>
      <Link to="/food" className="mt-2 inline-block text-sm font-semibold text-primary">
        Back to Food
      </Link>
    </div>
  ),
  component: CollectionPage,
});

function CollectionPage() {
  const { collection, restaurants } = Route.useLoaderData();
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-5">
      <h1 className="text-lg font-extrabold text-ink">{collection.title}</h1>
      {collection.description && (
        <p className="mt-1 text-sm text-muted-foreground">{collection.description}</p>
      )}
      <div className="mt-3">
        {restaurants.map((r) => (
          <RestaurantCard key={r.id} restaurant={r} />
        ))}
        {restaurants.length === 0 && (
          <p className="py-8 text-sm text-muted-foreground">This collection is being built.</p>
        )}
      </div>
    </div>
  );
}
