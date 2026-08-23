import { useState } from "react";
import { Play } from "lucide-react";

/**
 * Lightweight YouTube facade: shows the poster frame until the reader taps,
 * then swaps in the iframe. Keeps the property grid fast (no iframes on load).
 */
export function PropertyVideo({
  videoId,
  label,
}: {
  videoId: string;
  label: string;
}) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-ink">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
          title={`${label} — project video`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          className="h-full w-full border-0"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Play short video for ${label}`}
      className="group relative block aspect-video w-full overflow-hidden rounded-lg bg-muted"
    >
      <img
        src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
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
    </button>
  );
}
