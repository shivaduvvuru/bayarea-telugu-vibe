import { useState } from "react";
import { Heart, Share2, Check, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { shareLink } from "@/lib/saved";
import {
  useFavoritePhoto,
  useHiddenPhoto,
  type FavoritePhoto,
} from "@/lib/photo-favorites";
import { removeDislikedPhoto } from "@/lib/photo-moderation.functions";
import type { Article } from "@/lib/content";
import { cn } from "@/lib/utils";


/**
 * Favorite + dislike + share controls for a cinema photo.
 * Two tones: "light" for dark overlays (lightbox / tiles), "ink" on white cards.
 */
export function PhotoActions({
  article,
  tone = "ink",
  className,
}: {
  article: Article | FavoritePhoto;
  tone?: "light" | "ink";
  className?: string;
}) {
  const { favorite, toggle } = useFavoritePhoto(article);
  const { hidden, toggle: toggleHidden } = useHiddenPhoto(article);
  const [copied, setCopied] = useState(false);

  const btn = cn(
    "inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors",
    tone === "light"
      ? "bg-black/45 text-white backdrop-blur hover:bg-black/70"
      : "text-muted-foreground hover:bg-surface-tint hover:text-primary",
  );

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <button
        type="button"
        className={btn}
        aria-pressed={favorite}
        aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
        title={favorite ? "Remove from favorites" : "Add to favorites"}
        onClick={(e) => {
          stop(e);
          toggle();
        }}
      >
        <Heart
          className={cn("h-[18px] w-[18px]", favorite && "fill-current text-rose-500")}
          aria-hidden
        />
      </button>
      <button
        type="button"
        className={btn}
        aria-pressed={hidden}
        aria-label={hidden ? "Undo dislike" : "Dislike photo"}
        title={hidden ? "Undo dislike — photo will stay" : "Dislike — removed on next refresh"}
        onClick={(e) => {
          stop(e);
          toggleHidden();
        }}
      >
        <ThumbsDown
          className={cn("h-[18px] w-[18px]", hidden && "fill-current text-primary")}
          aria-hidden
        />
      </button>

      <button
        type="button"
        className={btn}
        aria-label="Share photo"
        title="Share photo"
        onClick={async (e) => {
          stop(e);
          const result = await shareLink(`/article/${article.slug}`, article.title, "photo");
          if (result === "copied") {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }
        }}
      >
        {copied ? (
          <Check className="h-[18px] w-[18px]" aria-hidden />
        ) : (
          <Share2 className="h-[18px] w-[18px]" aria-hidden />
        )}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Link copied" : ""}
      </span>
    </div>
  );
}
