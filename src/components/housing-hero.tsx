import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import heroImage from "@/assets/housing-hero.jpg";

const CARDS = [
  {
    icon: "🏠",
    title: "Homeowners",
    body: "How could this affect your property's value?",
  },
  {
    icon: "📈",
    title: "Home Buyers",
    body: "Where new housing is likely to appear.",
  },
  {
    icon: "🚆",
    title: "Transit",
    body: "Why Caltrain is driving the biggest changes.",
  },
  {
    icon: "📍",
    title: "Cities to Watch",
    body: "Palo Alto • Menlo Park • Redwood City • Mountain View • Sunnyvale.",
  },
  {
    icon: "💵",
    title: "Real Estate",
    body: "Will increased supply cool Bay Area prices?",
  },
  {
    icon: "❓",
    title: "FAQ",
    body: "The biggest questions Bay Area residents are asking.",
  },
];

/**
 * Featured Bay Area housing story: full-width 16:9 banner with a dark
 * gradient scrim, followed by six explainer cards.
 */
export function HousingHero() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <Link
        to="/category/$category"
        params={{ category: "city-news" }}
        className="group block overflow-hidden rounded-2xl border border-border bg-ink shadow-sm"
      >
        <div className="relative aspect-[4/3] w-full max-h-[520px] overflow-hidden sm:aspect-[16/9]">
          <img
            src={heroImage}
            alt="New apartment buildings under construction beside older homes near a Caltrain station on the Peninsula"
            width={1600}
            height={912}
            fetchPriority="high"
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-ink/95 via-ink/70 to-ink/20"
          />
          <div className="absolute inset-x-0 bottom-0 p-4 md:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-primary-foreground">
                Bay Area
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-white/80">
                4 min read
              </span>
            </div>
            <h2 className="mt-2.5 max-w-3xl text-2xl font-extrabold leading-tight text-white md:text-4xl">
              Bay Area Housing Is Changing. Is Your Neighborhood Next?
            </h2>
            <p className="mt-2 hidden max-w-2xl text-sm leading-relaxed text-white/85 md:block">
              California's new transit-oriented housing rules are beginning to reshape Peninsula
              cities. More homes, taller buildings and denser neighborhoods are coming near Caltrain
              stations—and that could affect home values, rents and future development across the
              Bay Area.
            </p>
            <span className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-ink transition-transform duration-200 group-hover:translate-x-1">
              Explore the Cities Affected →
            </span>
          </div>
        </div>
      </Link>

      <div
        id="housing-story-body"
        className="mt-5 space-y-3 text-[15px] leading-relaxed text-ink"
      >
        <p className={open ? "" : "line-clamp-3"}>
          For decades, many Peninsula neighborhoods changed very little. That is beginning to
          change. New California housing policies encourage cities to build significantly more homes
          near major transit corridors such as Caltrain.
        </p>
        {open && (
          <>
            <p>
              Cities including Palo Alto, Menlo Park, Redwood City, Mountain View and others are
              already evaluating proposals for higher-density housing close to stations.
            </p>
            <p>For Bay Area families, this raises important questions.</p>
            <p>
              Will home values rise or stabilize? Will rents become more affordable? Will traffic
              increase? Which neighborhoods are likely to change first?
            </p>
            <p>
              Whether we own a home, plan to buy one, or simply commute through these cities, these
              decisions will shape the Bay Area for years to come.
            </p>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="housing-story-body"
        className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-primary"
      >
        {open ? "Show less" : "Read full story"}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((c) => (
            <div
              key={c.title}
              className="rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
            >
              <p className="text-lg" aria-hidden>
                {c.icon}
              </p>
              <p className="mt-1 text-sm font-bold text-ink">{c.title}</p>
              <p className="mt-1 text-sm leading-snug text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
