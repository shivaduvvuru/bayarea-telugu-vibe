import { useEffect, useState } from "react";
import { Play, X } from "lucide-react";
import { youtubeThumbnail } from "@/lib/property-videos";

/**
 * Tap-to-play facade: the card shows only the poster frame, and the clip opens
 * in a modal player with identical controls on mobile and desktop (no iframes
 * load until the reader taps).
 */
export function PropertyVideo({
  videoId,
  label,
  clicks,
  onPlay,
}: {
  videoId: string;
  label: string;
  clicks?: number;
  onPlay?: () => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          onPlay?.();
        }}
        aria-label={`Play short video for ${label}`}
        className="group relative block aspect-video w-full overflow-hidden rounded-lg bg-muted"
      >
        <img
          src={youtubeThumbnail(videoId)}
          alt={`${label} project video thumbnail`}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
        <span className="absolute inset-0 bg-ink/25" aria-hidden />
        <span
          className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg"
          aria-hidden
        >
          <Play className="h-5 w-5 translate-x-[1px]" />
        </span>
        <span className="absolute bottom-1.5 left-1.5 rounded bg-ink/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
          Short video
        </span>
        {typeof clicks === "number" && clicks > 0 ? (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-ink/70 px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
            {clicks} {clicks === 1 ? "play" : "plays"}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${label} short video`}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/90 p-3 sm:p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="truncate text-sm font-bold text-primary-foreground">{label}</p>
              <button
                type="button"
                aria-label="Close video"
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink/70 text-primary-foreground"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-ink shadow-2xl">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                title={`${label} — project video`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                className="h-full w-full border-0"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
