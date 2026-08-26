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
  /micro[- ]?drama|micro[- ]?dramas|microdrama|mini[- ]?drama|short[- ]?drama|vertical (?:drama|series|video series|micro)|snap[- ]?drama|quick[- ]?drama|\breelshort\b|\bdramabox\b|\bflickreels\b|dramawave|goodshort|shortmax|moboreels|flickreels|holywater|my drama|\bkalos\b|melolo|pocket ?fm|kuku ?fm|flick ?tv|chai shots|bullet ?drama|duanju|短剧|숏드라마|세로드라마|vigloo|topreels|goodshort|fatafat|sharechat drama|మైక్రో డ్రామా|షార్ట్ డ్రామా/i;

/** Publishers and trade desks that cover the short-vertical business. */
const MICRO_HOSTS =
  /reelshort|dramabox|flickreels|flicktv|holywater|micro-?drama|short-?drama|goodshort|shortmax|flextv|netshort|moboreels|topshort|dreameshort|melolo|vigloo|hongguo|duanju|dataeye|tubefilter/i;

/**
 * Artist cues: the desk also carries the women who front these verticals in the
 * US, India and China. A story counts when a leading-lady word sits next to a
 * short-vertical cue, so ordinary film-star coverage stays in Cinema.
 */
const MICRO_ARTIST =
  /\b(actress|actresses|heroine|heroines|leading lady|female lead|star cast|glamour|glam)\b/i;
const MICRO_ARTIST_CONTEXT =
  /vertical|short[- ]?form|short[- ]?drama|micro|duanju|reelshort|dramabox|goodshort|shortmax|flick ?tv|kuku|pocket ?fm|sharechat|1[- ]?minute|60[- ]?second|episode drop/i;

/**
 * Live action only: the desk carries filmed verticals with real actors. Animated,
 * anime, AI-generated, motion-comic, webtoon and game-engine verticals are out.
 */
const NOT_LIVE_ACTION =
  /\banime\b|\banimated\b|\banimation\b|\bcartoon\b|\bmanhwa\b|\bmanhua\b|\bmanga\b|\bwebtoon\b|\bwebcomic\b|motion comic|\bcgi\b|\bvfx[- ]only\b|\bai[- ](?:generated|made|animated|avatar|actor|actors|cast)\b|\bgenerative ai\b|\bsora\b|\bveo\s?\d?\b|\bvirtual (?:idol|influencer|actor)\b|\bvtuber\b|machinima|\bmachine[- ]animated\b|\bpuppet(?:ry)?\b|stop[- ]motion|\bgacha\b|\bdonghua\b|动画|아니메|애니메이션|యానిమే|యానిమేషన్/i;

/** True when a story is about the vertical micro-drama format or its players. */
export function isMicroDrama(
  title: string | null | undefined,
  summary?: string | null,
  sourceUrl?: string | null,
): boolean {
  const text = `${title ?? ""} ${summary ?? ""}`;
  if (NOT_LIVE_ACTION.test(text)) return false;
  if (MICRO_TEXT.test(text)) return true;
  if (MICRO_ARTIST.test(text) && MICRO_ARTIST_CONTEXT.test(text)) return true;
  const url = (sourceUrl ?? "").toLowerCase();
  return MICRO_HOSTS.test(url) && MICRO_TEXT.test(text);
}


