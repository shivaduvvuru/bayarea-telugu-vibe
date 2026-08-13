import type { Article } from "@/lib/content";

/**
 * Prominent publisher credit.
 *
 * The site is a digest of newspapers and journals, so the source is treated as
 * first-class information on every card, row and article page — not a footnote.
 */
export function SourceChip({
  article,
  className = "",
}: {
  article: Pick<Article, "sourceName" | "sourceUrl">;
  className?: string;
}) {
  if (!article.sourceName) return null;
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-sm bg-surface-tint px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary ${className}`}
    >
      <span className="opacity-70">Via</span>
      <span className="truncate normal-case tracking-normal">{article.sourceName}</span>
    </span>
  );
}

/** Photo credit line for hotlinked publisher artwork. */
export function PhotoCredit({ name }: { name?: string | null }) {
  if (!name) return null;
  return (
    <figcaption className="mt-1 text-[11px] text-muted-foreground">Photo: {name}</figcaption>
  );
}

/** Explains the digest model wherever we list aggregated headlines. */
export function DigestNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[11px] leading-snug text-muted-foreground ${className}`}>
      A digest of newspapers and journals — every headline credits its publisher and links to the
      original report.
    </p>
  );
}
