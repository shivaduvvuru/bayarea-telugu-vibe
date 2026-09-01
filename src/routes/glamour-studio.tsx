import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { GLAMOUR_PLACEHOLDERS, GLAMOUR_TAGS } from "@/data/glamour-placeholders";
import { cn } from "@/lib/utils";

const TITLE = "Glamour Studio Gallery — Times Bay Area";
const DESC =
  "A responsive glamour and fashion photo gallery with hover zoom, tag filters and a full-screen lightbox viewer.";

export const Route = createFileRoute("/glamour-studio")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GlamourStudioPage,
});

function GlamourStudioPage() {
  const [tag, setTag] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  const shots = tag
    ? GLAMOUR_PLACEHOLDERS.filter((s) => s.tags.includes(tag))
    : GLAMOUR_PLACEHOLDERS;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Picture desk
        </p>
        <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">Glamour Studio</h1>
        <p className="mt-3 text-[17px] leading-relaxed text-muted-foreground">
          A demo grid of high-resolution glamour, fashion and editorial photography. These are
          stock placeholders — replace them with your own pictures by adding files to{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-sm">public/images/glamour/</code>.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap gap-2">
        <FilterChip label="All" active={tag === null} onClick={() => setTag(null)} />
        {GLAMOUR_TAGS.map((t) => (
          <FilterChip key={t} label={t} active={tag === t} onClick={() => setTag(t)} />
        ))}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {shots.map((shot, i) => (
          <figure key={shot.id} className="group m-0">
            <button
              type="button"
              onClick={() => setOpen(i)}
              className="block w-full overflow-hidden rounded-xl bg-muted"
              aria-label={`Open ${shot.title}`}
            >
              <img
                src={shot.src}
                alt={shot.title}
                loading="lazy"
                decoding="async"
                className="aspect-[3/4] w-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
              />
            </button>
            <figcaption className="mt-2">
              <p className="line-clamp-1 text-sm font-semibold text-ink">{shot.title}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {shot.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </figcaption>
          </figure>
        ))}
      </div>

      {shots.length === 0 && (
        <p className="mt-10 text-sm text-muted-foreground">No pictures match that tag.</p>
      )}

      {open !== null && shots[open] && (
        <Lightbox
          shots={shots}
          index={open}
          onClose={() => setOpen(null)}
          onIndex={(n) => setOpen(n)}
        />
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}

function Lightbox({
  shots,
  index,
  onClose,
  onIndex,
}: {
  shots: typeof GLAMOUR_PLACEHOLDERS;
  index: number;
  onClose: () => void;
  onIndex: (next: number) => void;
}) {
  const shot = shots[index]!;
  const go = (d: number) => onIndex((index + d + shots.length) % shots.length);

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
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={shot.title}
      onClick={onClose}
      className="fixed inset-0 z-[200] flex flex-col bg-black/95"
    >
      <div className="flex items-center justify-between px-4 py-3 text-white/80">
        <span className="text-xs font-semibold tabular-nums">
          {index + 1} / {shots.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close picture viewer"
          className="rounded-full p-2 hover:bg-white/10"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
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
        <img
          src={shot.src}
          alt={shot.title}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full object-contain"
        />
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

      <div className="px-4 pb-6 pt-3 text-white" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold">{shot.title}</p>
        <p className="mt-1 text-xs text-white/70">
          {shot.tags.join(" · ")} — photo: {shot.credit}
        </p>
      </div>
    </div>
  );
}
