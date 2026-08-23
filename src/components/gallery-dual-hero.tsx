import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Images, Pause, Play } from "lucide-react";
import type { Article } from "@/lib/content";
import { SourceChip } from "@/components/source-credit";
import { PhotoActions } from "@/components/photo-actions";
import { galleryImage } from "@/lib/story-image";
import { cdnImage } from "@/lib/img";

/** One pair of hero pictures is shown for this long. */
const PAIR_MS = 30_000;

function HeroSlot({
  article,
  label,
  fadeKey,
  onOpen,
}: {
  article: Article | undefined;
  label: string;
  fadeKey: number;
  onOpen?: () => void;
}) {
  const picture = article ? galleryImage(article.image) : null;
  if (!article || !picture) return null;
  return (
    <figure className="m-0 overflow-hidden rounded-lg border border-border bg-surface-tint">
      <div className="relative">
        <button
          type="button"
          onClick={onOpen}
          className="block w-full"
          aria-label={`Open picture: ${article.title}`}
        >
          <img
            key={`${fadeKey}-${picture}`}
            src={cdnImage(picture, 720)}
            alt={article.title}
            loading="eager"
            decoding="async"
            onError={(event) => {
              // Optimiser miss: fall back to the publisher's original file.
              if (event.currentTarget.src !== picture) event.currentTarget.src = picture;
            }}
            style={{ animationDuration: "700ms" }}
            className="aspect-[4/5] w-full animate-fade-in object-cover object-top sm:aspect-[3/4]"
          />
        </button>
        <PhotoActions article={article} tone="light" className="absolute right-2 top-2" />
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-ink/75 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-surface">
          <Images className="h-3 w-3" aria-hidden="true" /> {label}
        </span>
      </div>
      <figcaption className="px-3 py-2">
        <span className="line-clamp-1 text-[13px] font-semibold text-ink">{article.title}</span>
        <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          <SourceChip article={article} />
        </span>
      </figcaption>
    </figure>
  );
}

/**
 * Two hero-size slots showing one *pair* of Glamour pictures at a time.
 * Pair 0 = pictures 1 & 2, pair 1 = pictures 3 & 4, and so on; the pair
 * advances every 30 seconds (single timer, always cleaned up) and wraps around
 * when the folder has been fully shown.
 */
export function GalleryDualHero({
  items,
  onOpen,
}: {
  items: Article[];
  onOpen?: (index: number) => void;
}) {
  const usable = useMemo(() => items.filter((a) => !!galleryImage(a.image)), [items]);
  const pairCount = Math.max(1, Math.ceil(usable.length / 2));

  const [pairIndex, setPairIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  // Bumped on every change so both slots re-mount and cross-fade together.
  const [fadeKey, setFadeKey] = useState(0);
  const [tick, setTick] = useState(0); // manual controls restart the timer

  // Keep the index valid when the folder grows or shrinks mid-cycle.
  useEffect(() => {
    setPairIndex((prev) => (prev < pairCount ? prev : 0));
  }, [pairCount]);

  useEffect(() => {
    if (!playing || pairCount < 2) return;
    const id = window.setInterval(() => {
      setPairIndex((prev) => (prev + 1) % pairCount);
      setFadeKey((k) => k + 1);
    }, PAIR_MS);
    return () => window.clearInterval(id);
  }, [playing, pairCount, tick]);

  if (!usable.length) return null;

  const step = (delta: number) => {
    setPairIndex((prev) => (prev + delta + pairCount) % pairCount);
    setFadeKey((k) => k + 1);
    setTick((t) => t + 1);
  };

  const safePair = Math.min(pairIndex, pairCount - 1);
  const first = usable[(safePair * 2) % usable.length];
  const second = usable[safePair * 2 + 1] ?? (usable.length > 1 ? usable[0] : undefined);
  const indexOf = (a: Article | undefined) => (a ? items.findIndex((x) => x.slug === a.slug) : -1);

  return (
    <section className="mb-8" aria-label="Glamour showcase">
      <div className="grid gap-4 sm:grid-cols-2">
        <HeroSlot
          article={first}
          label="Slot 1"
          fadeKey={fadeKey}
          onOpen={() => onOpen?.(Math.max(indexOf(first), 0))}
        />
        <HeroSlot
          article={second}
          label="Slot 2"
          fadeKey={fadeKey}
          onOpen={() => onOpen?.(Math.max(indexOf(second), 0))}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => step(-1)}
          className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-semibold text-ink hover:border-primary hover:text-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Previous
        </button>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-semibold text-ink hover:border-primary hover:text-primary"
          aria-label={playing ? "Pause slideshow" : "Play slideshow"}
        >
          {playing ? (
            <Pause className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Play className="h-3.5 w-3.5" aria-hidden />
          )}
          {playing ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-semibold text-ink hover:border-primary hover:text-primary"
        >
          Next <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
        <span className="text-[11px] text-muted-foreground">
          Pair {safePair + 1} of {pairCount}
          {playing ? " • auto-switching every 30s" : " • paused"}
        </span>
      </div>
    </section>
  );
}
