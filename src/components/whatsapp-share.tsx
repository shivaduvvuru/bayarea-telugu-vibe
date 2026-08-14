import { canonical } from "@/lib/site";
import { whatsappUrl } from "@/lib/saved";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/** WhatsApp glyph — lucide has no brand icon for it. */
function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12.04 2C6.6 2 2.2 6.4 2.2 11.84c0 1.94.53 3.75 1.45 5.3L2 22l4.98-1.6a9.83 9.83 0 0 0 5.06 1.4c5.44 0 9.84-4.4 9.84-9.84S17.48 2 12.04 2Zm0 17.86c-1.6 0-3.1-.44-4.38-1.22l-.31-.19-2.96.95.96-2.87-.2-.32a7.94 7.94 0 0 1-1.23-4.27c0-4.42 3.6-8.02 8.02-8.02s8.02 3.6 8.02 8.02-3.6 8.02-8.02 8.02Zm4.53-5.86c-.25-.12-1.46-.72-1.68-.8-.23-.09-.39-.13-.55.12-.16.25-.63.8-.77.96-.14.16-.28.18-.53.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.14-.25-.02-.39.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.55-1.33-.75-1.82-.2-.48-.4-.42-.55-.42h-.47c-.16 0-.41.06-.63.31-.21.25-.82.8-.82 1.96s.84 2.28.96 2.44c.12.16 1.65 2.54 4.01 3.56.56.24 1 .39 1.34.5.56.18 1.08.15 1.48.09.45-.07 1.39-.57 1.58-1.11.2-.55.2-1.02.14-1.11-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  );
}

/**
 * Share to WhatsApp (personal chats, city groups, channels). Uses the
 * wa.me deep link — no API or account needed on our side.
 */
export function WhatsAppShare({
  path,
  title,
  context = "story",
  tone = "ink",
  className,
  label,
}: {
  /** In-app path such as `/article/my-story`, or an absolute URL. */
  path: string;
  title: string;
  context?: string;
  tone?: "light" | "ink" | "bare";
  className?: string;
  label?: string;
}) {
  const url = path.startsWith("http") ? path : canonical(path);

  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-full transition-colors";
  const toneCls =
    tone === "light"
      ? "bg-black/45 text-white backdrop-blur hover:bg-black/70"
      : tone === "bare"
        ? "text-muted-foreground hover:text-[#25D366]"
        : "text-muted-foreground hover:bg-surface-tint hover:text-[#25D366]";
  const size = label ? "h-9 px-3 text-xs font-semibold" : "h-9 w-9";

  return (
    <a
      href={whatsappUrl(url, title)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label ?? "Share on WhatsApp"}
      title={label ?? "Share on WhatsApp"}
      className={cn(base, toneCls, size, className)}
      onClick={(e) => {
        e.stopPropagation();
        track("share", { url, context: `${context}:whatsapp` });
      }}
    >
      <WhatsAppGlyph className="h-[18px] w-[18px] shrink-0" />
      {label}
    </a>
  );
}
