/**
 * Guards public copy against internal editorial notes.
 *
 * Collected items can carry newsroom instructions ("Verify details before
 * publishing", "Confirm timings with the temple") that were never meant for
 * readers. Any text shown on the public site passes through here first: the
 * note sentences are dropped and, if nothing readable is left, the caller shows
 * nothing at all rather than the note.
 */

/** Sentences that are workflow instructions, not reporting. */
const INTERNAL_NOTE =
  /(before publish(?:ing)?|verify details|verify with|confirm (?:timings|details|with)|add the (?:telugu|hindi|english) translation|needs? (?:editor|review)|awaiting (?:review|approval)|internal note|do not publish|draft only|todo\b|placeholder text|editor'?s? note)/i;

/** Splits on sentence boundaries, keeping the terminator with the sentence. */
function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/);
}

/**
 * Returns reader-safe text: internal-note sentences removed. Returns an empty
 * string when the whole value was a note.
 */
export function publicText(text: string | null | undefined): string {
  const raw = (text ?? "").trim();
  if (!raw) return "";
  const kept = sentences(raw)
    .filter((s) => s.trim() && !INTERNAL_NOTE.test(s))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  // A short leftover fragment ("Reported by SFist.") carries no information.
  if (kept.length < 25) return "";
  return kept;
}

/** Filters a bullet list down to reader-safe lines. */
export function publicBullets(list: unknown): string[] {
  const items = Array.isArray(list) ? list : [];
  return items
    .map((b) => (typeof b === "string" ? b.trim() : ""))
    .filter((b) => b && !INTERNAL_NOTE.test(b));
}

/** True when the text is an internal note and must never be displayed. */
export function isInternalNote(text: string | null | undefined): boolean {
  return INTERNAL_NOTE.test(text ?? "");
}
