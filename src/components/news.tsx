import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Clock } from "lucide-react";
import { type Article, articleLang, categoryBySlug, formatDate } from "@/lib/content";
import { useLang } from "@/lib/language";
import { StoryActions } from "@/components/story-actions";
import { SourceChip } from "@/components/source-credit";




/** Rough reading time from the WP HTML body. */
function readingTime(html: string) {
  const words = html.replace(/<[^>]*>/g, " ").trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 180));
}

function relativeText(iso: string) {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "";
  const days = Math.floor((Date.now() - d) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(iso);
}

/**
 * Renders the absolute date during SSR and swaps to a relative label after
 * hydration — cached HTML would otherwise disagree with the browser clock.
 */
export function RelativeDate({ iso }: { iso: string }) {
  const [text, setText] = useState(() => formatDate(iso));
  useEffect(() => setText(relativeText(iso)), [iso]);
  return <span>{text}</span>;
}

export function SectionHeading({
  te,
  en,
  more,
}: {
  te: string;
  en?: string;
  more?: ReactNode;
}) {
  // English is always the prominent caption; Telugu sits underneath in a
  // smaller supporting line.
  const english = en ?? te;
  return (
    <div className="section-rule mb-5 flex items-end justify-between gap-3 pb-2">
      <h2 className="min-w-0 text-xl font-bold text-ink sm:text-2xl">
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0">{english}</span>
          <ChevronRight className="h-5 w-5 shrink-0 text-primary" />
        </span>
        {te && te !== english && (
          <span className="te-text mt-0.5 block text-xs font-medium text-muted-foreground sm:text-sm">
            {te}
          </span>
        )}
      </h2>
      {more}
    </div>
  );
}

export function MoreLink({ category }: { category: string }) {
  const { t } = useLang();
  const cat = categoryBySlug(category);
  const en = cat?.en ?? category;
  const te = cat?.te ?? category;
  return (
    <Link
      to="/category/$category"
      params={{ category }}
      className="flex min-h-11 shrink-0 items-center rounded-sm bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary-dark"
    >
      {t(`All ${en} stories`, `${te} వార్తలు అన్నీ`)}
    </Link>
  );
}

export function CategoryTag({ article }: { article: Article }) {
  const { lang } = useLang();
  const cat = categoryBySlug(article.category);
  const text = cat ? (lang === "te" ? cat.te : cat.en) : article.categoryName;
  return (
    <span
      className={`inline-block bg-primary px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground ${
        lang === "te" ? "te-text" : ""
      }`}
    >
      {text}
    </span>
  );
}

/** Accurate language chip — reflects the script the story is actually written in. */
export function LangBadge({ article }: { article: Article }) {
  const isTe = articleLang(article) === "te";
  return (
    <span
      className="border border-border px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground"
      title={isTe ? "Written in Telugu" : "Written in English"}
    >
      <span className={isTe ? "te-text" : undefined}>{isTe ? "తెలుగు" : "English"}</span>
    </span>
  );
}

function Meta({ article }: { article: Article }) {
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <SourceChip article={article} />
      <RelativeDate iso={article.date} />
      <span aria-hidden>·</span>
      <span className="inline-flex items-center gap-1">
        <Clock className="h-3.5 w-3.5" />
        {readingTime(article.html)} min read
      </span>
      <span aria-hidden>·</span>
      <LangBadge article={article} />
    </p>
  );
}

/** Stable hue per story so text-only cards never look like duplicates. */
function hueOf(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

export function Thumb({
  article,
  priority = false,
  sizes,
  /** Portrait tiles (photo galleries) keep faces in frame. */
  ratio = "aspect-video",
}: {
  article: Article;
  priority?: boolean;
  sizes?: string;
  ratio?: string;
}) {
  if (!article.image) {
    // No stock photo: a typographic tile keyed to the story keeps the grid
    // distinct instead of repeating one generic image everywhere.
    const hue = hueOf(article.slug || article.title);
    const label = (article.categoryName || article.category || "News").toUpperCase();
    return (
      <div
        className={`flex ${ratio} w-full flex-col justify-between gap-2 p-3`}
        style={{
          background: `linear-gradient(135deg, hsl(${hue} 45% 92%), hsl(${(hue + 40) % 360} 40% 84%))`,
        }}
        aria-hidden
      >
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: `hsl(${hue} 45% 28%)` }}
        >
          {label}
        </span>
        <span
          className="line-clamp-3 text-sm font-semibold leading-snug"
          style={{ color: `hsl(${hue} 45% 22%)` }}
        >
          {article.title}
        </span>
      </div>
    );
  }
  return (
    <figure className="m-0">
      <img
        src={article.image}
        alt={article.title}
        width={1200}
        height={675}
        sizes={sizes}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        referrerPolicy="no-referrer-when-downgrade"
        className={`${ratio} w-full bg-surface-tint object-cover object-top`}
      />
      {article.sourceName && (
        <figcaption className="mt-1 text-[11px] text-muted-foreground">
          Photo: {article.sourceName}
        </figcaption>
      )}
    </figure>
  );
}


/** Headline gets the Telugu font only when the headline is actually Telugu. */
function headlineClass(article: Article, extra: string) {
  return `${articleLang(article) === "te" ? "te-text " : ""}${extra}`;
}

export function LeadCard({ article }: { article: Article }) {
  return (
    <article>
      <Link to="/article/$slug" params={{ slug: article.slug }} className="block">
        <Thumb article={article} priority sizes="(max-width: 768px) 100vw, 66vw" />
        <div className="-mt-4 ml-0 inline-block">
          <CategoryTag article={article} />
        </div>
        <h3
          className={headlineClass(
            article,
            "mt-3 line-clamp-3 text-2xl leading-snug font-bold headline-link md:text-3xl",
          )}
        >
          {article.title}
        </h3>
        {article.excerpt && (
          <p
            className={headlineClass(
              article,
              "mt-2 line-clamp-2 text-base text-muted-foreground",
            )}
          >
            {article.excerpt}
          </p>
        )}
        <Meta article={article} />
      </Link>
      <StoryActions
        id={article.slug}
        title={article.title}
        url={`/article/${article.slug}`}
        context="lead"
      />
    </article>
  );
}

export function StoryCard({ article }: { article: Article }) {
  return (
    <article className="group">
      <Link to="/article/$slug" params={{ slug: article.slug }}>
        <Thumb article={article} sizes="(max-width: 768px) 100vw, 33vw" />
        <div className="mt-3">
          <CategoryTag article={article} />
        </div>
        <h3
          className={headlineClass(
            article,
            "mt-2 line-clamp-3 text-lg leading-snug font-bold headline-link",
          )}
        >
          {article.title}
        </h3>
        {article.excerpt && (
          <p
            className={headlineClass(
              article,
              "mt-1.5 line-clamp-1 text-sm text-muted-foreground",
            )}
          >
            {article.excerpt}
          </p>
        )}
        <Meta article={article} />
      </Link>
      <StoryActions
        id={article.slug}
        title={article.title}
        url={`/article/${article.slug}`}
        context="card"
      />
    </article>
  );
}

export function ListRow({ article }: { article: Article }) {
  return (
    <li className="border-b border-border py-3 last:border-0">
      <Link
        to="/article/$slug"
        params={{ slug: article.slug }}
        className={headlineClass(
          article,
          "block min-h-11 text-base leading-snug font-semibold headline-link",
        )}
      >
        {article.title}
      </Link>
      <p className="mt-1 text-xs text-muted-foreground">
        <RelativeDate iso={article.date} />
      </p>
      <StoryActions
        id={article.slug}
        title={article.title}
        url={`/article/${article.slug}`}
        context="list"
      />
    </li>
  );
}

/** Compact card used inside the horizontal "Today in the Bay Area" rail. */
export function RailCard({ article }: { article: Article }) {
  return (
    <article className="w-[74vw] shrink-0 snap-start sm:w-64">
      <Link to="/article/$slug" params={{ slug: article.slug }}>
        <Thumb article={article} sizes="74vw" />
        <h3
          className={headlineClass(
            article,
            "mt-2 line-clamp-3 text-[15px] leading-snug font-bold headline-link",
          )}
        >
          {article.title}
        </h3>
        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <RelativeDate iso={article.date} />
          <LangBadge article={article} />
        </p>
      </Link>
    </article>
  );
}

export function HRail({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div
      className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="region"
      aria-label={label}
    >
      {children}
    </div>
  );
}

/** Clearly labelled sponsored slot — never disguised as editorial. */
export function SponsoredSlot({
  kind,
  title,
  body,
  cta,
  href,
}: {
  kind: string;
  title: string;
  body: string;
  cta: string;
  href: string;
}) {
  return (
    <aside className="border border-dashed border-primary/60 bg-surface-tint p-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-primary">{kind}</p>
      <h3 className="mt-1.5 text-lg font-bold text-ink">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      <a
        href={href}
        className="mt-3 inline-flex min-h-11 items-center rounded-sm border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
      >
        {cta}
      </a>
    </aside>
  );
}
