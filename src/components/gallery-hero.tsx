import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Images } from "lucide-react";
import type { Article } from "@/lib/content";
import { SourceChip } from "@/components/source-credit";
import { PhotoActions } from "@/components/photo-actions";
import { galleryImage } from "@/lib/story-image";
import { isSingleWoman } from "@/lib/cinema-topics";

/** The slots run continuously: a new picture takes the slot every 20 seconds. */
const ROTATE_MS = 20_000;
/** Later slots change halfway through the cycle, 10s after the one above them. */
export const HERO_STAGGER_MS = ROTATE_MS / 2;

/** Deterministic 32-bit hash so server and client agree on the shuffle. */
function seededOrder(length: number, seed: number) {
  const order = Array.from({ length }, (_, i) => i);
  // `offset` makes the second hero's initial server-render seed negative.
  // Normalize to an unsigned integer; JavaScript's `%` preserves a negative
  // sign and previously produced a negative shuffle index and an empty slot.
  let state = Math.imul(seed | 0, -1640531527) >>> 0;
  if (state === 0) state = 1;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}

/**
 * Wide picture break placed inside the city-news column: shows one photo from
 * the cinema gallery and swaps itself for another every 5 minutes, so the page
 * looks different on a later visit without a reload.
 *
 * Baseline (8-15-2026): every full-size slot rotates on a 5 minute cycle, the
 * picture is drawn at random (not the next one in the list), and consecutive
 * slots are staggered 2.5 minutes apart.
 */
export function GalleryHero({
  items,
  onOpen,
  offset = 0,
  exclude,
  className = "",
}: {
  items: Article[];
  /** Opens the swipeable viewer at this photo's position in `items`. */
  onOpen?: (index: number) => void;
  /** Slot number: shifts both the picture picked and its 2.5 min stagger. */
  offset?: number;
  /** Photo URLs already used elsewhere on the page. */
  exclude?: string[];
  className?: string;
}) {
  const [slot, setSlot] = useState(0);
  const [failedPictures, setFailedPictures] = useState<string[]>([]);

  useEffect(() => {
    if (items.length < 2) return;
    const current = () => Math.floor((Date.now() + offset * HERO_STAGGER_MS) / ROTATE_MS);
    setSlot(current());
    const id = window.setInterval(() => setSlot(current()), 5_000);
    return () => window.clearInterval(id);
  }, [items.length, offset]);

  const used = new Set(exclude ?? []);
  const seen = new Set<string>();
  const eligible = (a: Article) => {
    const picture = galleryImage(a.image);
    if (!picture || failedPictures.includes(picture) || used.has(picture) || seen.has(picture)) {
      return false;
    }
    seen.add(picture);
    return true;
  };
  // Full-size slots only carry solo-woman portraits; landscape frames and
  // mixed-company stills are rejected (landscape ones drop out on load below).
  let withPictures = items.filter(
    (a) => isSingleWoman(a.title, a.excerpt, a.sourceUrl) && eligible(a),
  );
  if (withPictures.length === 0) {
    seen.clear();
    withPictures = items.filter(eligible);
  }
  if (withPictures.length === 0) return null;

  // Random pick per cycle. The shuffle is reseeded on every cycle and the
  // read position also walks forward, so the slot keeps drawing a different
  // photo out of the Glamour folder instead of settling on a few favourites.
  // Slots of the same cycle share the shuffle, so two heroes on screen never
  // land on the same photo.
  const cycle = slot - offset;
  const order = seededOrder(withPictures.length, cycle);
  const pick = ((cycle + offset) % withPictures.length + withPictures.length) % withPictures.length;
  const index = order[pick]!;
  const article = withPictures[index] ?? withPictures[0];
  if (!article) return null;
  const picture = galleryImage(article.image);
  if (!picture) return null;
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
            loading="eager"
            decoding="async"
            onError={() =>
              setFailedPictures((current) =>
                current.includes(picture) ? current : [...current, picture],
              )
            }
            onLoad={(event) => {
              // Wide/landscape frames (box-office stills, event group shots)
              // are not portraits: drop them and let the slot pick again.
              const img = event.currentTarget;
              if (img.naturalWidth && img.naturalHeight / img.naturalWidth < 1.05) {
                setFailedPictures((current) =>
                  current.includes(picture) ? current : [...current, picture],
                );
              }
            }}
            className="aspect-[4/5] w-full object-cover object-top sm:aspect-[3/4]"
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
            <span>New picture every 5 min</span>
          </span>
        </span>
        <Link
          to="/category/$category"
          params={{ category: "gallery" }}
          className="shrink-0 text-[11px] font-bold uppercase tracking-[0.12em] text-primary"
        >
          Gallery
        </Link>
      </figcaption>
    </figure>
  );
}
