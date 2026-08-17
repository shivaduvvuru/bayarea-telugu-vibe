import { useState } from "react";
import { Bookmark, BookmarkCheck, Share2, Check, Heart, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { useSaved, shareLink } from "@/lib/saved";
import { useFavoritePhoto, useHiddenPhoto } from "@/lib/photo-favorites";
import { removeDislikedPhoto } from "@/lib/photo-moderation.functions";
import { useLang } from "@/lib/language";
import { WhatsAppShare } from "@/components/whatsapp-share";

const btn =
  "inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-tint hover:text-primary";

/** Save + share controls. Stops link navigation when nested inside a card. */
export function StoryActions({
  id,
  title,
  url,
  context = "story",
}: {
  id: string;
  title: string;
  url: string;
  context?: string;
}) {
  const { t } = useLang();
  const { saved, toggle } = useSaved(id);
  const snapshot = { id: 0, slug: id, title, image: null, date: "" };
  const { favorite, toggle: toggleFavorite } = useFavoritePhoto(snapshot);
  const { hidden, toggle: toggleHidden } = useHiddenPhoto(snapshot);
  const [copied, setCopied] = useState(false);

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="-ml-2.5 flex items-center gap-1">
      <button
        type="button"
        className={btn}
        aria-pressed={favorite}
        aria-label={favorite ? t("Unlike story", "అన్‌లైక్") : t("Like story", "లైక్")}
        title={favorite ? t("Unlike story", "అన్‌లైక్") : t("Like story", "లైక్")}
        onClick={(e) => {
          stop(e);
          toggleFavorite();
        }}
      >
        <Heart className={favorite ? "h-[18px] w-[18px] fill-current text-rose-500" : "h-[18px] w-[18px]"} />
      </button>
      <button
        type="button"
        className={btn}
        aria-pressed={hidden}
        aria-label={hidden ? t("Undo dislike", "అన్‌డూ") : t("Dislike story", "డిస్‌లైక్")}
        title={hidden ? t("Undo dislike", "అన్‌డూ") : t("Dislike — story is deleted", "డిస్‌లైక్ — తొలగించబడుతుంది")}
        onClick={(e) => {
          stop(e);
          const wasHidden = hidden;
          toggleHidden();
          if (wasHidden) return;
          // Editors (desk unlocked) delete the story site-wide; readers just
          // hide it on their own device.
          void removeDislikedPhoto({ data: { slug: id } })
            .then((res) => {
              if (res?.removed) toast.success(t("Story deleted", "కథనం తొలగించబడింది"));
            })
            .catch(() => {
              /* reader without desk access: local hide is enough */
            });
        }}
      >
        <ThumbsDown className={hidden ? "h-[18px] w-[18px] fill-current text-primary" : "h-[18px] w-[18px]"} />
      </button>
      <button
        type="button"
        className={btn}
        aria-pressed={saved}
        aria-label={saved ? t("Saved", "సేవ్ చేశారు") : t("Save", "సేవ్")}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle();
        }}
      >
        {saved ? (
          <BookmarkCheck className="h-[18px] w-[18px] text-primary" />
        ) : (
          <Bookmark className="h-[18px] w-[18px]" />
        )}
      </button>
      <button
        type="button"
        className={btn}
        aria-label={t("Share", "షేర్")}
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const result = await shareLink(url, title, context);
          if (result === "copied") {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }
        }}
      >
        {copied ? (
          <Check className="h-[18px] w-[18px] text-primary" />
        ) : (
          <Share2 className="h-[18px] w-[18px]" />
        )}
      </button>
      <WhatsAppShare path={url} title={title} context={context} tone="bare" />
      <span aria-live="polite" className="sr-only">
        {copied ? t("Link copied", "లింక్ కాపీ అయింది") : ""}
      </span>
    </div>
  );
}

export function SampleChip() {
  const { t } = useLang();
  return (
    <span className="inline-block rounded-full border border-amber-500/70 bg-amber-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800">
      {t("Sample content", "నమూనా కంటెంట్")}
    </span>
  );
}

export function SponsoredChip() {
  const { t } = useLang();
  return (
    <span className="inline-block rounded-full border border-primary px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary">
      {t("Sponsored", "స్పాన్సర్డ్")}
    </span>
  );
}