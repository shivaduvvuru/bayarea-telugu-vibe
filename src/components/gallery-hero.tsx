import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Images } from "lucide-react";
import type { Article } from "@/lib/content";
import { SourceChip } from "@/components/source-chip";
import { PhotoActions } from "@/components/photo-actions";
import { storyImage } from "@/lib/story-image";

/** A new picture takes the slot every quarter hour. */
const ROTATE_MS = 15 * 60 * 1000;

/**
 * Wide picture break placed inside the city-news column: shows one photo from
 * the cinema gallery and swaps itself for another every 15 minutes, so the page
 * looks different on a later visit without a reload.
 *
 * The first render always uses index 0 (same on server and client, no hydration
 * mismatch); the time-based slot is applied right after mount.
 */
export function GalleryHero({
  items,
  onOpen,
  className = "",
}: {
  items: Article[];
  /** Opens the swipeable viewer at this photo's position in `items`. */
  onOpen?: (index: number) => void;
  className?: string;
}) {
  const [slot, setSlot] = useState(0);

  useEffect(() => {
    if (items.length < 2) return;
    const current = () => Math.floor(Date.now() / ROTATE_MS);
    setSlot(current());
    const id = window.setInterval(() => setSlot(current()), 30_000);
    return () => window.clearInterval(id);
  }, [items.length]);

  const withPictures = items.filter((a) => storyImage(a));
  if (withPictures.length === 0) return null;

  const index = ((slot % withPictures.length) + withPictures.length) % withPictures.length;
  const article = withPictures[index]!;
  const picture = storyImage(article)!;
  const position = items.findIndex((a) => a.slug === article.slug);

  return (
    <figure
      className={`m-0 overflow-hidden rounded-lg border border-border bg-surface-tint ${className}`}
    >
      <div className="relative">
        <button
          type="button"
          onClick={() => onOpen?.(position < 0 ? 0 : position)}
          className="block w-full"
          aria-label={`Open picture: ${article.title}`}
        >
          <img
            key={picture}
            src={picture}
            alt={article.title}
            loading="lazy"
            decoding="async"
            className="aspect-[16/9] w-full animate-fade-in object-cover object-top"
          />
        </button>
        <PhotoActions article={article} tone="light" className="absolute right-2 top-2" />
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-ink/75 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-surface">
          <Images className="h-3 w-3" aria-hidden="true" /> Picture of the moment
        </span>
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <span className="min-w-0">
          <span className="line-clamp-1 text-[13px] font-semibold text-ink">{article.title}</span>
          <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <SourceChip article={article} />
            <span>New picture every 15 min</span>
          </span>
        </span>
        <Link
          to="/category/gallery"
          className="shrink-0 text-[11px] font-bold uppercase tracking-[0.12em] text-primary"
        >
          Gallery
        </Link>
      </figcaption>
    </figure>
  );
}
