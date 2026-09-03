import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Newspaper,
  MapPinned,
  UtensilsCrossed,
  Sparkles,
  Clapperboard,
  
} from "lucide-react";
import { canonical } from "@/lib/site";
import { useLang } from "@/lib/language";
import { ShortVideoRail, SwipeStories } from "@/components/genz";
import { SectionHeading } from "@/components/news";

const TITLE = "Explore the Bay Area — Indian community news, food, culture & video";
const DESC =
  "Browse Bay Area Indian local news, things to do, food, culture, cinema and short videos in one place.";
const URL = canonical("/explore");

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: ExplorePage,
});

const TILES = [
  { en: "Local News", te: "స్థానిక వార్తలు", icon: Newspaper, category: "city-news" },
  { en: "Things to Do", te: "ఏం చేయాలి", icon: MapPinned, to: "/events" as const },
  { en: "Food", te: "ఆహారం", icon: UtensilsCrossed, category: "restaurants" },
  { en: "Culture", te: "సంస్కృతి", icon: Sparkles, category: "community" },
  { en: "Cinema/OTT", te: "సినిమా", icon: Clapperboard, category: "cinema" },
];

function ExplorePage() {
  const { lang, t } = useLang();
  const tileClass =
    "flex min-h-24 flex-col justify-between rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:py-8">
      <h1 className="text-3xl font-bold text-ink">{t("Explore", "ఎక్స్‌ప్లోర్")}</h1>
      <p className="mt-2 text-base text-muted-foreground">
        {t(
          "Everything Indian happening around us in the Bay Area — fast, visual and useful.",
          "బే ఏరియాలో మన చుట్టూ జరుగుతున్న తెలుగు విషయాలన్నీ ఒకే చోట.",
        )}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {TILES.map((tile) => {
          const Icon = tile.icon;
          const body = (
            <>
              <Icon className="h-6 w-6 text-primary" aria-hidden />
              <span className="mt-3 text-[15px] font-bold text-ink">
                <span className={lang === "te" ? "te-text" : undefined}>
                  {lang === "te" ? tile.te : tile.en}
                </span>
              </span>
            </>
          );
          if (tile.to)
            return (
              <Link key={tile.en} to={tile.to} className={tileClass}>
                {body}
              </Link>
            );
          return (
            <Link
              key={tile.en}
              to="/category/$category"
              params={{ category: tile.category! }}
              className={tileClass}
            >
              {body}
            </Link>
          );
        })}
      </div>

      <section className="mt-10">
        <SectionHeading te="60 సెకన్ల బే ఏరియా" en="60-Second Bay Area" />
        <ShortVideoRail />
      </section>

      <section className="mt-10">
        <SectionHeading te="స్వైప్ స్టోరీస్" en="Swipe Stories" />
        <SwipeStories />
      </section>
    </div>
  );
}