/**
 * Client-safe classifier for the Micro-Drama desk.
 *
 * Micro-dramas (vertical short-form serialised drama, 1-3 minute episodes) are
 * a fast-growing format in China (ReelShort, DramaBox, Kuaishou), India
 * (Amazon MX Player, Pocket FM/Kuku FM video, Flick TV, Chai Shots) and the US
 * (ReelShort, FlickReels, Holywater). Those stories read as cinema to the film
 * classifier, so this check runs first and keeps them in their own section.
 */

export const MICRO_DRAMA_SLUG = "micro-drama";

/** Format cues: the phrase itself, plus the named apps and studios. */
const MICRO_TEXT =
  /micro[- ]?drama|micro[- ]?dramas|microdrama|mini[- ]?drama|short[- ]?drama|vertical (?:drama|series|video series|micro)|snap[- ]?drama|quick[- ]?drama|\breelshort\b|\bdramabox\b|dramawave|goodshort|shortmax|moboreels|flickreels|holywater|my drama|\bkalos\b|melolo|pocket ?fm|kuku ?fm|flick ?tv|chai shots|bullet ?drama|duanju|短剧|మైక్రో డ్రామా|షార్ట్ డ్రామా/i;

/** Publishers and trade desks that cover the short-vertical business. */
const MICRO_HOSTS = /reelshort|dramabox|flicktv|holywater|micro-?drama/i;

/** True when a story is about the vertical micro-drama format or its players. */
export function isMicroDrama(
  title: string | null | undefined,
  summary?: string | null,
  sourceUrl?: string | null,
): boolean {
  const text = `${title ?? ""} ${summary ?? ""}`;
  if (MICRO_TEXT.test(text)) return true;
  return MICRO_HOSTS.test((sourceUrl ?? "").toLowerCase());
}
