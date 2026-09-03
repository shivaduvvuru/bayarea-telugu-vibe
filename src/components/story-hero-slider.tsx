import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SmartImage } from "@/components/smart-image";
import articleFallback from "@/assets/article-fallback-community.jpg";
import type { Article } from "@/lib/content";
import { formatDate } from "@/lib/content";
import { SourceChip } from "@/components/source-credit";
import { buildHeroSet, HERO_FADE_MS, HERO_MAX_SLIDES, HERO_SLIDE_MS } from "@/lib/hero-select";
import { claimForPage, noteUse } from "@/lib/image-usage";

/**
 * Compact editorial hero: a curated set of 4–5 stories that cross-fade every
 * six seconds. Deliberately sized well under a full mobile screen so the next
 * homepage section is always visible:
 *
 *   mobile  ~320px  (min 300, max 360)
 *   desktop ~460px  (min 420, max 500, capped at 58vh)
 *
 * Auto-rotation pauses on hover, on touch and while the tab is hidden.
 */
export function StoryHeroSlider({
  articles,
  exclude,
  className = "",
}: {
  articles: Article[];
  /** Images already spoken for by other homepage slots. */
  exclude?: Set<string>;
  className?: string;
}) {
  // The rest window lives in this browser's storage, which the server cannot
  // read. First paint ignores it so both renders match; after hydration the
  // client re-picks with rest rules applied.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const slides = useMemo(
    () => buildHeroSet(articles, { max: HERO_MAX_SLIDES, exclude, ignoreRest: !hydrated }),
    [articles, exclude, hydrated],
  );

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  // Reserve each hero image for this page render so no section below reprints it.
  useEffect(() => {
    slides.forEach((s) => claimForPage(s.image));
  }, [slides]);

  // Log the slide on screen so it rests out of the hero for a week.
  useEffect(() => {
    const current = slides[index];
    if (current) noteUse(current.image, "hero", current.subject);
  }, [index, slides]);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % slides.length),
      HERO_SLIDE_MS,
    );
    return () => window.clearInterval(id);
  }, [paused, slides.length]);

  // Stop rotating while the tab is in the background.
  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  if (slides.length === 0) return null;

  const go = (next: number) => {
    setIndex(((next % slides.length) + slides.length) % slides.length);
    // A manual move pauses briefly, then rotation resumes.
    setPaused(true);
    window.setTimeout(() => setPaused(false), 3 * HERO_SLIDE_MS);
  };

  return (
    <section
      aria-label="Top stories"
      className={`relative overflow-hidden rounded-2xl border border-border bg-ink ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        setPaused(true);
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX ?? null;
        touchX.current = null;
        if (start !== null && end !== null && Math.abs(end - start) > 40) {
          go(index + (end < start ? 1 : -1));
        } else {
          window.setTimeout(() => setPaused(false), 2 * HERO_SLIDE_MS);
        }
      }}
    >
      <div className="relative h-[320px] min-h-[300px] max-h-[360px] w-full md:h-[460px] md:min-h-[420px] md:max-h-[min(500px,58vh)]">
        {slides.map((slide, i) => (
          <Link
            key={slide.article.slug}
            to="/article/$slug"
            params={{ slug: slide.article.slug }}
            aria-hidden={i === index ? undefined : true}
            tabIndex={i === index ? 0 : -1}
            className="absolute inset-0 block"
            style={{
              opacity: i === index ? 1 : 0,
              transition: `opacity ${HERO_FADE_MS}ms ease-in-out`,
              pointerEvents: i === index ? "auto" : "none",
            }}
          >
            <SmartImage
              src={slide.image}
              fallbackSrc={articleFallback}
              alt={slide.article.title}
              // Only the first slide is a priority download; every other slide
              // stays lazy so it never competes with it on a phone.
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "low"}
              decoding="async"
              sizes="(max-width: 768px) 100vw, 1100px"
              className="h-full w-full object-cover object-[center_28%]"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-ink/95 via-ink/70 to-ink/20"
            />
            <div className="absolute inset-x-0 bottom-0 p-4 pb-10 md:p-7 md:pb-12">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
                  {slide.label}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/80">
                  {formatDate(slide.article.date)}
                </span>
              </div>
              <h2 className="mt-2 line-clamp-3 max-w-3xl text-[20px] font-extrabold leading-tight text-white md:text-3xl">
                {slide.article.title}
              </h2>
              {slide.article.excerpt ? (
                <p className="mt-1.5 hidden max-w-2xl line-clamp-1 text-sm text-white/85 md:block">
                  {slide.article.excerpt}
                </p>
              ) : null}
            </div>
          </Link>
        ))}

        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous story"
              className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/35 p-2 text-white backdrop-blur transition-colors hover:bg-black/60 md:block"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next story"
              className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/35 p-2 text-white backdrop-blur transition-colors hover:bg-black/60 md:block"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5">
              {slides.map((slide, i) => (
                <button
                  key={slide.article.slug}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Story ${i + 1}`}
                  aria-current={i === index}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? "w-5 bg-white" : "w-1.5 bg-white/50"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <p className="flex items-center justify-between gap-2 px-3 py-2">
        <SourceChip article={slides[index]!.article} />
        <span className="text-[11px] text-muted-foreground">
          Top stories · {index + 1}/{slides.length}
        </span>
      </p>
    </section>
  );
}
