import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { Article } from "@/lib/content";
import { PhotoActions } from "@/components/photo-actions";

/**
 * Full-screen picture viewer for the Gallery grid.
 * Keyboard (arrows / Esc), on-screen arrows and swipe move between photos so
 * readers can browse the set without going back to the grid each time.
 *
 * Rendered through a portal on <body>: inside the page tree an animated
 * ancestor (transform) became the containing block for `position: fixed`, so
 * the viewer opened as a small box over a dark strip instead of full screen.
 */
export function GalleryLightbox({
  items,
  index,
  onClose,
  onIndexChange,
}: {
  items: Article[];
  index: number;
  onClose: () => void;
  onIndexChange: (next: number) => void;
}) {
  const article = items[index];
  const touchX = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => setLoaded(false), [index]);

  const go = useCallback(
    (delta: number) => {
      if (items.length === 0) return;
      // Walk past photos whose source refused to load so paging never lands
      // on an empty black frame.
      let next = index;
      for (let step = 0; step < items.length; step++) {
        next = (next + delta + items.length) % items.length;
        const src = items[next]?.image;
        if (!src || !failed.includes(src)) break;
      }
      onIndexChange(next);
    },
    [failed, index, items, onIndexChange],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [go, onClose]);

  // Warm the neighbouring photos so paging feels instant.
  useEffect(() => {
    [1, -1].forEach((d) => {
      const src = items[(index + d + items.length) % items.length]?.image;
      if (src) {
        const img = new Image();
        img.src = src;
      }
    });
  }, [index, items]);

  const broken = useMemo(
    () => Boolean(article?.image && failed.includes(article.image)),
    [article?.image, failed],
  );

  // The current photo turned out to be unreachable: move to the next one.
  useEffect(() => {
    if (broken) go(1);
  }, [broken, go]);

  if (!article || !mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={article.title}
      className="fixed inset-0 z-[200] flex flex-col bg-black"
      onClick={onClose}
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX ?? null;
        touchX.current = null;
        if (start == null || end == null) return;
        if (Math.abs(end - start) > 50) go(end < start ? 1 : -1);
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 text-white/80">
        <span className="text-xs font-semibold tabular-nums">
          {index + 1} / {items.length}
        </span>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <PhotoActions article={article} tone="light" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close picture viewer"
            className="rounded-full p-2 hover:bg-white/10"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
        <button
          type="button"
          aria-label="Previous picture"
          onClick={(e) => {
            e.stopPropagation();
            go(-1);
          }}
          className="absolute left-2 z-10 rounded-full bg-white/10 p-3 text-white hover:bg-white/25"
        >
          <ChevronLeft className="h-6 w-6" aria-hidden />
        </button>
        {article.image && !broken ? (
          <>
            {!loaded && (
              <span className="absolute text-xs font-semibold text-white/60">Loading picture…</span>
            )}
            <img
              key={article.image}
              src={article.image}
              alt={article.title}
              decoding="async"
              referrerPolicy="no-referrer-when-downgrade"
              onLoad={() => setLoaded(true)}
              onError={() =>
                setFailed((current) =>
                  article.image && !current.includes(article.image)
                    ? [...current, article.image]
                    : current,
                )
              }
              onClick={(e) => e.stopPropagation()}
              className={`max-h-full max-w-full object-contain transition-opacity ${
                loaded ? "opacity-100" : "opacity-0"
              }`}
            />
          </>
        ) : (
          <p className="max-w-md text-center text-white">{article.title}</p>
        )}
        <button
          type="button"
          aria-label="Next picture"
          onClick={(e) => {
            e.stopPropagation();
            go(1);
          }}
          className="absolute right-2 z-10 rounded-full bg-white/10 p-3 text-white hover:bg-white/25"
        >
          <ChevronRight className="h-6 w-6" aria-hidden />
        </button>
      </div>

      <div className="px-4 pb-5 pt-3 text-white" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold leading-snug">{article.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/70">
          {article.sourceName && (
            <span>
              Photo: {article.sourceName}
              {article.sourceUrl && (
                <>
                  {" — "}
                  <a
                    href={article.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="font-semibold underline"
                  >
                    view original
                  </a>
                </>
              )}
            </span>
          )}
          <Link
            to="/article/$slug"
            params={{ slug: article.slug }}
            className="font-semibold underline"
          >
            Open full story
          </Link>
        </p>
      </div>
    </div>,
    document.body,
  );
}
