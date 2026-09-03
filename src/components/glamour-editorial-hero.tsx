import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import glamourHeroOne from "@/assets/glamour-hero-editorial-1.jpg";
import glamourHeroTwo from "@/assets/glamour-hero-editorial-2.jpg";
import glamourHeroThree from "@/assets/glamour-hero-editorial-3.jpg";

const ROTATE_MS = 18_000;

const SLIDES = [
  {
    image: glamourHeroOne,
    title: "Style in the spotlight",
    detail: "Celebrating Indian fashion, cinema, and confident new voices.",
  },
  {
    image: glamourHeroTwo,
    title: "Culture, color, and a fresh point of view",
    detail: "A bright look at the artists and stories shaping the season.",
  },
  {
    image: glamourHeroThree,
    title: "The red carpet, reimagined",
    detail: "Cinema style with a polished, family-friendly finish.",
  },
] as const;

export function GlamourEditorialHero({ className = "" }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % SLIDES.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [paused]);

  const move = (delta: number) => {
    setIndex((current) => (current + delta + SLIDES.length) % SLIDES.length);
  };

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-border bg-ink ${className}`}
      aria-label="Glamour editorial spotlight"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(event) => {
        touchX.current = event.touches[0]?.clientX ?? null;
        setPaused(true);
      }}
      onTouchEnd={(event) => {
        const start = touchX.current;
        const end = event.changedTouches[0]?.clientX ?? null;
        touchX.current = null;
        if (start !== null && end !== null && Math.abs(end - start) > 40) {
          move(end < start ? 1 : -1);
        }
        window.setTimeout(() => setPaused(false), 4_000);
      }}
    >
      <div className="relative aspect-[16/9] min-h-[280px] w-full sm:min-h-[360px] md:min-h-[440px]">
        {SLIDES.map((slide, slideIndex) => (
          <div
            key={slide.title}
            role="group"
            aria-roledescription="slide"
            aria-label={`${slideIndex + 1} of ${SLIDES.length}: ${slide.title}`}
            aria-hidden={slideIndex === index ? undefined : true}
            className={`absolute inset-0 transition-opacity duration-500 ease-in-out ${
              slideIndex === index ? "opacity-100" : "pointer-events-none opacity-0"
            }` }
          >
            <img
              src={slide.image}
              alt={slide.title}
              width={1440}
              height={900}
              loading={slideIndex === 0 ? "eager" : "lazy"}
              decoding="async"
              className="h-full w-full object-cover object-center"
            />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/95 via-ink/55 to-ink/10" />
            <div className="absolute inset-x-0 bottom-0 p-5 pb-12 sm:p-7 sm:pb-14">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary-foreground/85">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                Glamour spotlight
              </div>
              <h2 className="mt-2 max-w-2xl text-2xl font-bold leading-tight text-primary-foreground sm:text-4xl">
                {slide.title}
              </h2>
              <p className="mt-2 max-w-xl text-sm text-primary-foreground/80 sm:text-base">{slide.detail}</p>
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={() => move(-1)}
          aria-label="Previous Glamour spotlight"
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-ink/60 text-primary-foreground hover:bg-ink/80"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={() => move(1)}
          aria-label="Next Glamour spotlight"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-ink/60 text-primary-foreground hover:bg-ink/80"
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </Button>

        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
          {SLIDES.map((slide, slideIndex) => (
            <button
              key={slide.title}
              type="button"
              aria-label={`Show Glamour spotlight ${slideIndex + 1}`}
              aria-current={slideIndex === index}
              onClick={() => move(slideIndex - index)}
              className={`h-2 rounded-full transition-all ${
                slideIndex === index ? "w-7 bg-primary" : "w-2 bg-primary-foreground/60"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
