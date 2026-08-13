import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { Article } from "@/lib/content";
import { PhotoActions } from "@/components/photo-actions";

/**
 * Full-screen picture viewer for the Gallery grid.
 * Keyboard (arrows / Esc), on-screen arrows and swipe move between photos so
 * readers can browse the set without going back to the grid each time.
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

  const go = useCallback(
    (delta: number) => {
      const next = (index + delta + items.length) % items.length;
      onIndexChange(next);
    },
    [index, items.length, onIndexChange],
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

  if (!article) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={article.title}
      className="fixed inset-0 z-[100] flex flex-col bg-black/95"
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
        {article.image ? (
          <img
            key={article.image}
            src={article.image}
            alt={article.title}
            decoding="async"
            referrerPolicy="no-referrer-when-downgrade"
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full object-contain"
          />
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

      <div
        className="px-4 pb-5 pt-3 text-white"
        onClick={(e) => e.stopPropagation()}
      >
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
    </div>
  );
}
