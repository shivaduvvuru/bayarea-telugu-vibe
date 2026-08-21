import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, ExternalLink, Newspaper, Sparkles } from "lucide-react";
import { heroSlides, type HeroSlide } from "@/lib/hero-slides";
import { cn } from "@/lib/utils";

const AUTOPLAY_MS = 6000;

function SlideBadge({ slide }: { slide: HeroSlide }) {
  const banner = slide.type === "banner";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]",
        banner
          ? "bg-primary text-primary-foreground"
          : "bg-primary-foreground/15 text-primary-foreground",
      )}
    >
      {banner ? (
        <Sparkles className="h-3 w-3 shrink-0" aria-hidden />
      ) : (
        <Newspaper className="h-3 w-3 shrink-0" aria-hidden />
      )}
      {banner ? "Featured partner" : "Anniversary special"}
    </span>
  );
}

function Cta({ slide }: { slide: HeroSlide }) {
  const label = slide.ctaText ?? "View details";
  const cls =
    "inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-dark";
  if (!slide.linkUrl) return null;
  if (slide.linkUrl.startsWith("http")) {
    return (
      <a href={slide.linkUrl} target="_blank" rel="noopener noreferrer" className={cls}>
        {label}
        <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
      </a>
    );
  }
  return (
    <Link to={slide.linkUrl} className={cls}>
      {label}
      <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
    </Link>
  );
}

/** Context column: sponsor, headline, highlights and the call to action. */
function SlideContext({ slide }: { slide: HeroSlide }) {
  return (
    <div className="flex min-w-0 flex-col justify-center gap-3 p-5 sm:p-7">
      <div className="flex flex-wrap items-center gap-2">
        <SlideBadge slide={slide} />
        {slide.sponsorName ? (
          <span className="truncate text-[11px] font-semibold uppercase tracking-widest text-primary-foreground/70">
            {slide.sponsorName}
          </span>
        ) : null}
      </div>
      <h3 className="text-xl font-bold leading-tight text-primary-foreground sm:text-2xl md:text-3xl">
        {slide.title}
      </h3>
      {slide.subtitle ? (
        <p className="text-sm text-primary-foreground/75 sm:text-base">{slide.subtitle}</p>
      ) : null}
      {slide.highlights?.length ? (
        <ul className="space-y-1.5">
          {slide.highlights.map((h) => (
            <li
              key={h}
              className="flex items-start gap-2 text-xs font-medium text-primary-foreground/80 sm:text-sm"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              {h}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="pt-1">
        <Cta slide={slide} />
      </div>
    </div>
  );
}

function SlideBody({ slide, active }: { slide: HeroSlide; active: boolean }) {
  const skyscraper = slide.type === "skyscraper_feature";
  return (
    <div className="relative h-full w-full">
      {/* Blurred backdrop tinted with the artwork's dominant colour. */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 100% at 70% 0%, ${slide.tint ?? "#333"} 0%, rgba(10,10,12,0.94) 70%)`,
        }}
        aria-hidden
      />
      <img
        src={slide.imageUrl}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-2xl"
      />
      <div
        className={cn(
          "relative grid h-full",
          skyscraper
            ? "grid-rows-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,42%)_minmax(0,1fr)] md:grid-rows-1"
            : "grid-rows-1",
        )}
      >
        {skyscraper ? (
          <div className="flex min-h-0 items-center justify-center p-3 md:p-5">
            <img
              src={slide.imageUrl}
              alt={`${slide.sponsorName ?? "Sponsor"} — ${slide.title}`}
              loading={active ? "eager" : "lazy"}
              decoding="async"
              className="max-h-full w-auto max-w-full rounded-xl object-contain shadow-2xl ring-1 ring-primary-foreground/15"
            />
          </div>
        ) : (
          <img
            src={slide.imageUrl}
            alt={slide.title}
            loading={active ? "eager" : "lazy"}
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover opacity-70"
          />
        )}
        <div className={cn("relative min-w-0", skyscraper ? "" : "flex")}>
          <SlideContext slide={slide} />
        </div>
      </div>
    </div>
  );
}

/**
 * Sponsor carousel: the CREDAI banner leads, followed by the vertical
 * (skyscraper) anniversary-edition features. Autoplays every 6s, pauses on
 * hover/touch and while the tab is hidden, and supports swipe on mobile.
 */
export function SponsorHeroCarousel({
  slides = heroSlides,
  className,
}: {
  slides?: HeroSlide[];
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % slides.length),
      AUTOPLAY_MS,
    );
    return () => window.clearInterval(id);
  }, [paused, slides.length]);

  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  if (!slides.length) return null;
  const go = (next: number) => setIndex(((next % slides.length) + slides.length) % slides.length);

  return (
    <section
      aria-label="Featured partners"
      aria-roledescription="carousel"
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-ink",
        className,
      )}
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
        }
        window.setTimeout(() => setPaused(false), 2 * AUTOPLAY_MS);
      }}
    >
      <div className="relative h-[520px] w-full sm:h-[560px] md:h-[440px]">
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}: ${slide.title}`}
            aria-hidden={i === index ? undefined : true}
            className="absolute inset-0"
            style={{
              opacity: i === index ? 1 : 0,
              transition: "opacity 700ms ease-in-out",
              pointerEvents: i === index ? "auto" : "none",
            }}
          >
            <SlideBody slide={slide} active={i === index} />
          </div>
        ))}

        {slides.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous slide"
              onClick={() => go(index - 1)}
              className="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-ink/60 text-primary-foreground backdrop-blur transition-colors hover:bg-ink/80"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={() => go(index + 1)}
              className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-ink/60 text-primary-foreground backdrop-blur transition-colors hover:bg-ink/80"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
            <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-1.5 bg-gradient-to-t from-ink/80 to-transparent px-3 py-2.5">
              {slides.map((slide, i) => (
                <button
                  key={slide.id}
                  type="button"
                  aria-label={`Go to ${slide.sponsorName ?? slide.title}`}
                  aria-current={i === index}
                  onClick={() => go(i)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors",
                    i === index
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-primary-foreground/30 text-primary-foreground/70 hover:border-primary-foreground/60",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      i === index ? "bg-primary-foreground" : "bg-primary-foreground/60",
                    )}
                    aria-hidden
                  />
                  <span className="max-w-[9rem] truncate">
                    {slide.isCredai ? "CREDAI" : (slide.sponsorName ?? slide.title)}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
