import { Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, Bookmark, Clock, Flame, MapPin, Share2 } from "lucide-react";
import type { Article } from "@/lib/content";
import { getCityHeadline } from "@/lib/headline.functions";
import { SmartImage } from "@/components/smart-image";

type Headline = NonNullable<Awaited<ReturnType<typeof getCityHeadline>>>;
import { RelativeDate } from "@/components/news";
import { Button } from "@/components/ui/button";
import { shareLink, useSaved } from "@/lib/saved";

/** Shared query so the hero and the sticky ticker read one headline. */
export const cityHeadlineQuery = queryOptions({
  queryKey: ["city-headline"],
  queryFn: () => getCityHeadline(),
  staleTime: 5 * 60 * 1000,
  refetchInterval: 15 * 60 * 1000,
  refetchOnWindowFocus: true,
});

function readMinutes(article: Article) {
  const text = `${article.html} ${article.excerpt}`.replace(/<[^>]*>/g, " ").trim();
  return Math.max(1, Math.round(text.split(/\s+/).length / 180));
}

function HeroActions({ article }: { article: Article }) {
  const { saved, toggle } = useSaved(article.slug);
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      <Button asChild size="lg" className="font-semibold">
        <Link to="/article/$slug" params={{ slug: article.slug }}>
          Read Full Story
        </Link>
      </Button>
      <Button
        type="button"
        size="lg"
        variant="outline"
        onClick={async () => {
          const res = await shareLink(`/article/${article.slug}`, article.title, "headline");
          if (res === "copied") toast.success("Link copied");
        }}
      >
        <Share2 className="h-4 w-4" aria-hidden /> Share
      </Button>
      <Button type="button" size="lg" variant="outline" onClick={toggle} aria-pressed={saved}>
        <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} aria-hidden />
        {saved ? "Bookmarked" : "Bookmark"}
      </Button>
    </div>
  );
}

/** Option 1 hero: the prominent City News headline story. */
export function CityHeadlineHero({
  label,
  article,
}: {
  label: string | null;
  article: Article;
}) {
  return (
    <section
      aria-label="City News headline"
      className="overflow-hidden rounded-2xl border border-border bg-ink text-primary-foreground shadow-xl"
    >
      <div className="grid gap-0 md:grid-cols-[1.15fr_1fr]">
        <div className="group relative order-1 overflow-hidden md:order-2">
          {article.image ? (
            <figure className="m-0 h-full">
              <SmartImage
                src={article.image}
                alt={article.title}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                optimizedWidth={960}
                sizes="(max-width: 768px) 100vw, 45vw"
                className="h-56 w-full object-cover object-top transition-transform duration-700 group-hover:scale-105 md:h-full md:min-h-[22rem]"
              />
              {article.sourceName && (
                <figcaption className="absolute bottom-0 right-0 bg-ink/70 px-2 py-1 text-[11px] text-primary-foreground/80">
                  Photo: {article.sourceName}
                </figcaption>
              )}
            </figure>
          ) : (
            <div className="h-40 w-full bg-primary/25 md:h-full" aria-hidden />
          )}
        </div>

        <div className="order-2 p-5 sm:p-8 md:order-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex animate-pulse items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
              <Flame className="h-3 w-3" aria-hidden />
              {label ?? "City Exclusive"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-primary-foreground/25 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground/80">
              <MapPin className="h-3 w-3" aria-hidden /> City News
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-primary-foreground/70">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              <RelativeDate iso={article.date} />
            </span>
          </div>

          <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight md:text-5xl">
            <Link
              to="/article/$slug"
              params={{ slug: article.slug }}
              className="transition-colors hover:text-primary-foreground/80"
            >
              {article.title}
            </Link>
          </h2>

          {article.excerpt && (
            <p className="mt-4 line-clamp-3 text-lg font-medium text-primary-foreground/75">
              {article.excerpt}
            </p>
          )}

          <div className="mt-6 flex min-w-0 items-center gap-3">
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
              aria-hidden
            >
              {(article.sourceName ?? article.author).slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {article.sourceName ?? article.author}
              </p>
              <p className="flex items-center gap-1 text-xs text-primary-foreground/70">
                <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                Verified Reporter · {readMinutes(article)} min read
              </p>
            </div>
          </div>

          <HeroActions article={article} />
        </div>
      </div>
    </section>
  );
}

/** "Trending in City News" — three-up cards under the headline. */
export function TrendingGrid({ articles }: { articles: Article[] }) {
  if (!articles.length) return null;
  return (
    <section aria-label="Trending in City News" className="mt-8">
      <h3 className="section-rule mb-4 flex items-center gap-2 pb-2 text-lg font-bold text-ink">
        <Flame className="h-4 w-4 shrink-0 text-primary" aria-hidden /> Trending in City News
      </h3>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((a) => (
          <article key={a.id} className="group">
            <Link to="/article/$slug" params={{ slug: a.slug }} className="block">
              {a.image ? (
                <SmartImage
                  src={a.image}
                  alt={a.title}
                  loading="lazy"
                  decoding="async"
                  optimizedWidth={640}
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="aspect-video w-full rounded-xl bg-surface-tint object-cover object-top transition-transform duration-500 group-hover:scale-[1.02]"
                />
              ) : (
                <div className="aspect-video w-full rounded-xl bg-surface-tint" aria-hidden />
              )}
              <span className="mt-3 inline-block rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
                {a.categoryName}
              </span>
              <h4 className="mt-2 line-clamp-3 text-base font-bold leading-snug headline-link">
                {a.title}
              </h4>
            </Link>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {readMinutes(a)} min read · <RelativeDate iso={a.date} />
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

/** Self-contained block used on the City News page. */
export function CityHeadlineBlock({
  trending = [],
  initial,
}: {
  trending?: Article[];
  /** Headline resolved by the route loader, so the server and client first
   * render match instead of the hero popping in after hydration. */
  initial?: Headline | null;
}) {
  const { data } = useQuery(
    initial ? { ...cityHeadlineQuery, initialData: initial } : cityHeadlineQuery,
  );
  if (!data) return null;
  const rest = trending.filter((a) => a.slug !== data.article.slug).slice(0, 3);
  return (
    <div className="mb-10">
      <CityHeadlineHero label={data.label} article={data.article} />
      <TrendingGrid articles={rest} />
    </div>
  );
}
