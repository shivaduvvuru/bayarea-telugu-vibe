import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, HeartHandshake, Play } from "lucide-react";
import { PROPERTY_FEATURES, propertyImage } from "@/lib/property-showcase";
import { cn } from "@/lib/utils";

/** One property page holds the slot for 15 minutes, then the next one takes it. */
export const PROPERTY_HERO_ROTATE_MS = 15 * 60 * 1000;

/**
 * Hero-size slide from the property folder: a single skyscraper feature from the
 * Telugu Times 23rd Anniversary Special, changing once every 15 minutes.
 */
export function PropertyHero({ className }: { className?: string }) {
  // Server and first client paint agree on slide 0; rotation starts after mount
  // so the 15-minute clock cannot cause a hydration mismatch.
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const pick = () =>
      setIndex(
        Math.floor(Date.now() / PROPERTY_HERO_ROTATE_MS) % PROPERTY_FEATURES.length,
      );
    pick();
    const id = window.setInterval(pick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const p = PROPERTY_FEATURES[index % PROPERTY_FEATURES.length];
  if (!p) return null;

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-xl border border-primary/30 bg-surface-tint",
        className,
      )}
      aria-label="Property feature"
    >
      <Link to="/property" className="block">
        <div className="relative bg-ink/5">
          <img
            src={propertyImage(p.id)}
            alt={`${p.project} — ${p.developer}`}
            loading="lazy"
            className="mx-auto max-h-[70vh] w-full object-contain"
          />
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary-foreground">
            <Building2 className="h-3 w-3" aria-hidden />
            Property
          </span>
        </div>
        <div className="p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
            {p.developer}
          </p>
          <h3 className="mt-1 text-[17px] font-bold leading-snug text-ink">{p.project}</h3>
          {p.location ? (
            <p className="mt-1 text-sm text-muted-foreground">{p.location}</p>
          ) : null}
          {p.note ? (
            <p className="mt-1 text-xs text-muted-foreground">{p.note}</p>
          ) : null}
          <span className="mt-2 inline-block text-xs font-bold text-primary">
            View all projects →
          </span>
        </div>
      </Link>
      <div className="absolute right-3 top-3 flex flex-col gap-2">
        {p.videoId ? (
          <a
            href={`https://www.youtube.com/watch?v=${p.videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-ink/65 px-2.5 py-1.5 text-[10px] font-bold text-primary-foreground backdrop-blur transition-colors hover:bg-primary"
          >
            <Play className="h-3.5 w-3.5" aria-hidden />
            Short video
          </a>
        ) : null}
        <a
          href="/property/credai-hyderabad-2026#enquire"
          className="inline-flex items-center gap-1.5 rounded-full bg-ink/65 px-2.5 py-1.5 text-[10px] font-bold text-primary-foreground backdrop-blur transition-colors hover:bg-primary"
        >
          <HeartHandshake className="h-3.5 w-3.5" aria-hidden />
          I&apos;m interested
        </a>
      </div>
    </section>
  );
}
