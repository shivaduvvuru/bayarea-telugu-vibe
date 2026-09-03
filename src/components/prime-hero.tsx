import { Link } from "@tanstack/react-router";
import type { Article } from "@/lib/content";
import { formatDate } from "@/lib/content";
import { usableImage } from "@/lib/story-image";
import { SourceChip } from "@/components/source-credit";
import { SmartImage } from "@/components/smart-image";

/**
 * Prime slot for a live story. Used once the hand-built prime banner passes its
 * freshness threshold, so the top of the homepage always leads with something
 * current.
 */
export function PrimeHero({ article }: { article: Article }) {
  const picture = usableImage(article.image);

  return (
    <div>
      <Link
        to="/article/$slug"
        params={{ slug: article.slug }}
        className="group block overflow-hidden rounded-2xl border border-border bg-ink shadow-sm"
      >
        <div className="relative aspect-[4/3] max-h-[520px] w-full overflow-hidden sm:aspect-[16/9]">
          {picture ? (
            <SmartImage
              src={picture}
              alt=""
              fetchPriority="high"
              decoding="async"
              optimizedWidth={960}
              sizes="(max-width: 768px) 100vw, 66vw"
              className="h-full w-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            />
          ) : (
            <div aria-hidden className="h-full w-full bg-surface-tint" />
          )}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-ink/95 via-ink/70 to-ink/20"
          />
          <div className="absolute inset-x-0 bottom-0 p-4 md:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-primary-foreground">
                {article.categoryName}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-white/80">
                {formatDate(article.date)}
              </span>
            </div>
            <h2 className="mt-2.5 max-w-3xl text-2xl font-extrabold leading-tight text-white md:text-4xl">
              {article.title}
            </h2>
            {article.excerpt ? (
              <p className="mt-2 hidden max-w-2xl text-sm leading-relaxed text-white/85 md:block">
                {article.excerpt}
              </p>
            ) : null}
            <span className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-ink transition-transform duration-200 group-hover:translate-x-1">
              Read the full report →
            </span>
          </div>
        </div>
      </Link>
      <p className="mt-2">
        <SourceChip article={article} />
      </p>
    </div>
  );
}
