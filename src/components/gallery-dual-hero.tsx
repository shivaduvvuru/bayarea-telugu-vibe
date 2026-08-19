import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Images, Pause, Play } from "lucide-react";
import type { Article } from "@/lib/content";
import { SourceChip } from "@/components/source-credit";
import { PhotoActions } from "@/components/photo-actions";
import { galleryImage } from "@/lib/story-image";

/** Both hero slots advance together on this cadence. */
const SLIDE_MS = 20_000;

function HeroSlot({
  article,
  label,
  onOpen,
}: {
  article: Article | undefined;
  label: string;
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
            key={picture}
            src={picture}
            alt={article.title}
            loading="eager"
            decoding="async"
            className="aspect-[4/5] w-full object-cover object-top transition-opacity duration-500 sm:aspect-[3/4]"
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
 * Two hero-size slots side by side. Slot 1 walks the odd-numbered pictures
 * (1st, 3rd, 5th…), Slot 2 the even-numbered ones, and both step forward
 * together — by autoplay or with the Prev/Next controls — until the whole
 * Glamour folder has been showcased.
 */
export function GalleryDualHero({
  items,
  onOpen,
}: {
  items: Article[];
  onOpen?: (index: number) => void;
}) {
  const usable = items.filter((a) => !!galleryImage(a.image));
  // Positions in `items` so the lightbox opens on the right photo.
  const odd = usable.filter((_, i) => i % 2 === 0);
  const even = usable.filter((_, i) => i % 2 === 1);
  const steps = Math.max(odd.length, even.length);

  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing || steps < 2) return;
    const id = window.setInterval(() => setStep((s) => (s + 1) % steps), SLIDE_MS);
    return () => window.clearInterval(id);
  }, [playing, steps]);

  if (steps === 0) return null;

  const first = odd[step % (odd.length || 1)];
  const second = even.length ? even[step % even.length] : undefined;
  const indexOf = (a: Article | undefined) => (a ? items.findIndex((x) => x.slug === a.slug) : -1);

  return (
    <section className="mb-8" aria-label="Glamour showcase">
      <div className="grid gap-4 sm:grid-cols-2">
        <HeroSlot
          article={first}
          label="Slot 1"
          onOpen={() => onOpen?.(Math.max(indexOf(first), 0))}
        />
        <HeroSlot
          article={second}
          label="Slot 2"
          onOpen={() => onOpen?.(Math.max(indexOf(second), 0))}
        />
      </div>
      <div className="mt-3 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setStep((s) => (s - 1 + steps) % steps)}
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
          onClick={() => setStep((s) => (s + 1) % steps)}
          className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-semibold text-ink hover:border-primary hover:text-primary"
        >
          Next <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
        <span className="text-[11px] text-muted-foreground">
          {step + 1} / {steps}
        </span>
      </div>
    </section>
  );
}
