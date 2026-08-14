import { useState } from "react";
import { Bookmark, BookmarkCheck, Share2, Check } from "lucide-react";
import { useSaved, shareLink } from "@/lib/saved";
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
  const [copied, setCopied] = useState(false);

  return (
    <div className="-ml-2.5 flex items-center gap-1">
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