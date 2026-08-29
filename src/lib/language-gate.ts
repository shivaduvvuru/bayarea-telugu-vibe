/**
 * English-only gate for the cinema / micro-drama desks.
 *
 * The desks cover Telugu and pan-Indian cinema, but the site publishes in
 * English, so a headline written in Telugu, Devanagari, Tamil, Kannada,
 * Malayalam, CJK, Korean, Cyrillic, Arabic, etc. is dropped before it ever
 * reaches summarization (a Gemini call on a headline we would not publish is
 * wasted spend).
 */

/** Letters written in a non-Latin script. */
const NON_LATIN_LETTER =
  /[\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0E00-\u0E7F\u1100-\u11FF\u3040-\u30FF\u3130-\u318F\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF]/;

const LATIN_LETTER = /[A-Za-z\u00C0-\u024F]/;

/** Share of letters in `text` that are written in the Latin alphabet (0-1). */
export function latinLetterShare(text: string | null | undefined): number {
  let latin = 0;
  let other = 0;
  for (const ch of text ?? "") {
    if (LATIN_LETTER.test(ch)) latin += 1;
    else if (NON_LATIN_LETTER.test(ch)) other += 1;
  }
  const total = latin + other;
  return total === 0 ? 0 : latin / total;
}

/**
 * True when a headline reads as English (majority Latin script). Titles with no
 * letters at all — numerals or emoji only — are not English either.
 */
export function isEnglishTitle(title: string | null | undefined): boolean {
  const text = (title ?? "").trim();
  if (!text) return false;
  return latinLetterShare(text) >= 0.6;
}

/** Convenience inverse used by the collector funnel (`dropped_language`). */
export function isNonEnglishTitle(title: string | null | undefined): boolean {
  return !isEnglishTitle(title);
}
