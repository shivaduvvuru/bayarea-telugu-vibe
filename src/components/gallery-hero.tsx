import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Images } from "lucide-react";
import type { Article } from "@/lib/content";
import { SourceChip } from "@/components/source-credit";
import { PhotoActions } from "@/components/photo-actions";
import { useFavoritePhotos } from "@/lib/photo-favorites";
import { galleryImage } from "@/lib/story-image";
import { isSingleWoman } from "@/lib/cinema-topics";
import { markShown, shownAt, shownThisWeek } from "@/lib/photo-history";
import { swapGlamourPocket } from "@/lib/gallery-pocket.functions";

/** Client-side guard so several slots cannot ask for a new pocket at once. */
let lastPocketRequest = 0;


/** The slots run continuously: a new picture takes the slot every 20 seconds. */
const ROTATE_MS = 20_000;
/** Later slots change halfway through the cycle, 10s after the one above them. */
export const HERO_STAGGER_MS = ROTATE_MS / 2;

/**
 * Picture each full-size slot currently holds, keyed by slot number. Plain
 * module state on purpose: writing it costs no re-render, so slots can avoid
 * each other's photos without the state loop that used to blank the page.
 */
const activePicks = new Map<number, string>();


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
 * the Glamour folder and swaps itself for another every 20 seconds.
 *
 * Baseline (8-15-2026): every full-size slot rotates on a 20-second cycle,
 * the picture is drawn at random (not the next one in the list), and consecutive
 * slots are staggered 10 seconds apart. The same photo never repeats within the
 * last 24 picks.
 */
export function GalleryHero({
  items,
  onOpen,
  offset = 0,
  className = "",
}: {
  items: Article[];
  /** Opens the swipeable viewer at this photo's position in `items`. */
  onOpen?: (index: number) => void;
  /** Slot number: shifts both the picture picked and its 10s stagger. */
  offset?: number;
  className?: string;
}) {
  // Start from the slot number so server and client paint the same initial
  // picture, and two heroes never begin with the same photo.
  const [slot, setSlot] = useState(offset);
  const [failedPictures, setFailedPictures] = useState<string[]>([]);
  

  // Photos the reader hearted, so the slots can bring them back.
  const { favorites } = useFavoritePhotos();

  // All hooks must run before any early return to keep hook order stable.
  useEffect(() => {
    if (items.length < 2) return;
    const current = () => Math.floor((Date.now() + offset * HERO_STAGGER_MS) / ROTATE_MS);
    setSlot(current());
    const id = window.setInterval(() => setSlot(current()), 5_000);
    return () => window.clearInterval(id);
  }, [items.length, offset]);

  const seen = new Set<string>();

  const baseEligible = (a: Article) => {
    const picture = galleryImage(a.image);
    if (!picture || failedPictures.includes(picture)) return false;
    if (seen.has(picture)) return false;
    seen.add(picture);
    return true;
  };

  // Full-size slots only carry solo-woman portraits; landscape frames and
  // mixed-company stills are rejected (landscape ones drop out on load below).
  let withPictures = items.filter(
    (a) => isSingleWoman(a.title, a.excerpt, a.sourceUrl) && baseEligible(a),
  );
  if (withPictures.length === 0) {
    seen.clear();
    withPictures = items.filter(baseEligible);
  }
  if (withPictures.length === 0) {
    // Last resort: the browser has failed everything eligible. The full-size
    // slot must never disappear, so fall back to any Glamour picture we have.
    seen.clear();
    withPictures = items.filter((a) => {
      const picture = galleryImage(a.image);
      if (!picture || seen.has(picture)) return false;
      seen.add(picture);
      return true;
    });
  }

  // Random pick per cycle. The shuffle is reseeded on every cycle, so the slot
  // keeps drawing a different photo out of the Glamour folder.
  const cycle = slot - offset;

  // A photo that has already held a full-size slot this week is out of the
  // rotation until the week is up, so the slots never re-run the same picture.
  const fresh = (list: Article[]) =>
    list.filter((a) => {
      const picture = galleryImage(a.image);
      return !!picture && !shownThisWeek(picture);
    });

  // Hearted pictures lead: the slots work through every liked photo that has
  // not run this week before going back to the wider Glamour folder.
  const likedSlugs = new Set(favorites.map((p) => p.slug));
  const liked = withPictures.filter((a) => likedSlugs.has(a.slug));
  const freshLiked = fresh(liked);
  const freshAll = fresh(withPictures);

  let pool: Article[];
  if (freshLiked.length) {
    // Liked photos take two of every three cycles while unseen ones remain.
    pool = freshAll.length && ((cycle % 3) + 3) % 3 === 2 ? freshAll : freshLiked;
  } else if (freshAll.length) {
    pool = freshAll;
  } else {
    // The whole folder has run this week: come back to it oldest-shown first.
    pool = [...withPictures].sort(
      (a, b) => shownAt(galleryImage(a.image) ?? "") - shownAt(galleryImage(b.image) ?? ""),
    );
  }

  const order = seededOrder(pool.length || 1, cycle);
  // Slots step through the shared shuffle by their slot number. Because slots
  // are staggered they can sit on neighbouring cycles, so also walk forward past
  // any picture another slot currently holds — two heroes on screen never show
  // the same photo.
  const taken = new Set(
    [...activePicks.entries()].filter(([key]) => key !== offset).map(([, url]) => url),
  );
  let article: Article | null = null;
  let picture: string | null = null;
  for (let step = 0; step < (pool.length || 1); step += 1) {
    const pick = pool.length
      ? (((cycle + offset + step) % pool.length) + pool.length) % pool.length
      : 0;
    const candidate = pool[order[pick]!] ?? null;
    const candidatePicture = candidate ? galleryImage(candidate.image) : null;
    if (!candidate || !candidatePicture) continue;
    article = candidate;
    picture = candidatePicture;
    if (!taken.has(candidatePicture)) break;
  }
  if (picture) activePicks.set(offset, picture);
  const position = article && picture ? items.findIndex((a) => a.slug === article!.slug) : -1;

  // Log the picture once it is on screen so it stays out of the rotation for a
  // week. Done in an effect: the shown log is browser-only state.
  useEffect(() => {
    if (picture) markShown(picture);
  }, [picture]);

  // The live pocket has been fully used (every eligible photo already ran this
  // week): ask the backend for the next archived pocket of ~50 pictures and
  // refresh the folder. One slot does this, throttled on both sides.
  const requestPocket = useServerFn(swapGlamourPocket);
  const queryClient = useQueryClient();
  const exhausted = offset === 0 && withPictures.length > 0 && !freshAll.length && !freshLiked.length;
  useEffect(() => {
    if (!exhausted) return;
    if (Date.now() - lastPocketRequest < 3 * 60_000) return;
    lastPocketRequest = Date.now();
    void requestPocket({ data: undefined })
      .then((res) => {
        if (res?.restored) void queryClient.invalidateQueries({ queryKey: ["posts"] });
      })
      .catch(() => undefined);
  }, [exhausted, requestPocket, queryClient]);





  if (withPictures.length === 0 || !article || !picture) return null;

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
            <span>New picture every 20 sec</span>
          </span>
        </span>
        <Link
          to="/category/$category"
          params={{ category: "gallery" }}
          className="shrink-0 text-[11px] font-bold uppercase tracking-[0.12em] text-primary"
        >
          Glamour
        </Link>
      </figcaption>
    </figure>
  );
}
