import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { useFavoritePhotos } from "@/lib/photo-favorites";
import { PhotoActions } from "@/components/photo-actions";
import { GalleryLightbox } from "@/components/gallery-lightbox";
import { RelativeDate } from "@/components/news";
import type { Article } from "@/lib/content";

export const Route = createFileRoute("/favorites")({
  head: () => {
    const title = "Saved cinema photos — Bay Area Telugu Times";
    const description =
      "Your saved cinema and gallery pictures from the Bay Area Telugu Times digest, ready to browse and share.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "noindex" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: FavoritesPage,
});

function FavoritesPage() {
  const { favorites, clear } = useFavoritePhotos();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // The viewer only needs picture fields; pad the snapshot to the Article shape.
  const items: Article[] = favorites.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: "",
    html: "",
    date: p.date,
    author: "",
    image: p.image,
    category: "gallery",
    categoryName: "Glamourie",
    sourceName: p.sourceName ?? null,
    sourceUrl: p.sourceUrl ?? null,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="flex items-center gap-2 text-3xl font-bold text-ink">
        <Heart className="h-6 w-6 fill-current text-rose-500" aria-hidden /> Saved photos
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Kept on this device. Tap a picture to browse full screen, or share it with the share button.
      </p>

      {favorites.length === 0 ? (
        <p className="mt-8 text-muted-foreground">
          No saved photos yet. Tap the heart on any picture in the{" "}
          <Link
            to="/category/$category"
            params={{ category: "gallery" }}
            className="font-semibold underline"
          >
            Glamourie
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((a, i) => (
              <figure key={a.slug} className="m-0">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setViewerIndex(i)}
                    className="block w-full text-left"
                  >
                    <div className="aspect-[3/4] overflow-hidden rounded-lg bg-surface-tint">
                      {a.image ? (
                        <img
                          src={a.image}
                          alt={a.title}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer-when-downgrade"
                          className="h-full w-full object-cover object-top"
                        />
                      ) : null}
                    </div>
                  </button>
                  <PhotoActions article={a} tone="light" className="absolute right-2 top-2" />
                </div>
                <figcaption className="mt-2">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink">
                    {a.title}
                  </p>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {a.sourceName ? <span>Photo: {a.sourceName}</span> : null}
                    <RelativeDate iso={a.date} />
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
          <button
            type="button"
            onClick={clear}
            className="mt-8 rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary"
          >
            Clear all saved photos
          </button>
        </>
      )}

      {viewerIndex !== null && items[viewerIndex] && (
        <GalleryLightbox
          items={items}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </div>
  );
}
