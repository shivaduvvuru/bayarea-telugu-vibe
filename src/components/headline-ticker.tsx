import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, X } from "lucide-react";
import { cityHeadlineQuery } from "@/components/city-headline-hero";
import { RelativeDate } from "@/components/news";

const KEY = "headline-ticker-dismissed";

/**
 * Sticky breaking-news bar for the active City News headline. Dismissal is
 * remembered for the browsing session only, so a new visit sees it again.
 */
export function HeadlineTicker() {
  // Rendered only after hydration: the dismissal state lives in sessionStorage
  // and would otherwise disagree with the server HTML.
  const [ready, setReady] = useState(false);
  const [dismissedSlug, setDismissedSlug] = useState<string | null>(null);
  const { data } = useQuery({ ...cityHeadlineQuery, enabled: ready });

  useEffect(() => {
    try {
      setDismissedSlug(window.sessionStorage.getItem(KEY));
    } catch {
      setDismissedSlug(null);
    }
    setReady(true);
  }, []);

  if (!ready || !data) return null;
  const { article, label } = data;
  if (dismissedSlug === article.slug) return null;

  return (
    <div className="sticky top-0 z-40 border-b border-nav-hover/40 bg-nav text-nav-foreground">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest">
          <span className="relative flex h-2 w-2" aria-hidden>
            <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-nav-foreground/80" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-nav-foreground" />
          </span>
          {label ?? "Headline News"}
        </span>
        <Link
          to="/article/$slug"
          params={{ slug: article.slug }}
          className="group flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold"
        >
          <span className="truncate">{article.title}</span>
          <span className="hidden shrink-0 items-center gap-1 text-xs font-medium text-nav-foreground/80 sm:inline-flex">
            <RelativeDate iso={article.date} />
          </span>
          <span className="hidden shrink-0 items-center gap-1 text-xs font-semibold sm:inline-flex">
            Read Story
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </Link>
        <button
          type="button"
          aria-label="Dismiss headline"
          className="shrink-0 rounded-full p-1 hover:bg-white/20"
          onClick={() => {
            try {
              window.sessionStorage.setItem(KEY, article.slug);
            } catch {
              /* private mode */
            }
            setDismissedSlug(article.slug);
          }}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
