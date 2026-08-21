import { useSuspenseQuery } from "@tanstack/react-query";
import { Thumb, RelativeDate } from "@/components/news";
import { SourceChip } from "@/components/source-credit";
import { PhotoActions } from "@/components/photo-actions";
import { GalleryHero } from "@/components/gallery-hero";
import { useHiddenPhotos } from "@/lib/photo-favorites";
import { postsQuery } from "@/lib/category-query";
import type { Article } from "@/lib/content";

/** Picture-desk tile used by the Gallery section — opens the swipeable viewer. */
export function GalleryTile({ article, onOpen }: { article: Article; onOpen: () => void }) {
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

/**
 * Hero-size Glamour slide dropped into the City News feed. Exactly two run on
 * the page and they sit ten news items apart; no other Glamour artwork appears
 * while scrolling city news.
 */
export function CityNewsGlamourSlide({ slot }: { slot: number }) {
  const { data } = useSuspenseQuery(postsQuery("gallery"));
  const { hidden, hiddenImages } = useHiddenPhotos();
  const items = data.filter(
    (a) => !hidden.includes(a.slug) && !(a.image && hiddenImages.includes(a.image)),
  );
  if (!items.length) return null;
  return <GalleryHero items={items} offset={slot} className="my-6" />;
}
