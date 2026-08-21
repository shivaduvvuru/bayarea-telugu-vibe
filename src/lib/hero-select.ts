/**
 * Hero story selection.
 *
 * The homepage hero is a curated *story* slider, not a random photo slideshow.
 * Slides are chosen deterministically so a refresh does not reshuffle the front
 * page, using:
 *
 *   editorial score  = local relevance + reader interest + freshness + artwork
 *   least-recently-used = an image that ran in the hero rests for 7 days
 *   diversity        = no two slides may share the same subject
 *
 * No randomness anywhere: the same content always produces the same hero set,
 * and the set only changes when the content or the usage history changes.
 */

import type { Article } from "./content";
import { ageInDays } from "./prime-story";
import { isBayArea, isBayAreaSource } from "./bay-area";
import { classifyIndia } from "./india-topics";
import { looksHighRes, usableImage } from "./story-image";
import { isResting, lastUsed, timesUsed } from "./image-usage";

/** Maximum slides in the hero — a curated set, never a long gallery. */
export const HERO_MAX_SLIDES = 5;
/** Auto-rotation interval per slide. */
export const HERO_SLIDE_MS = 6_000;
/** Cross-fade duration between slides. */
export const HERO_FADE_MS = 600;

export type HeroSlide = {
  article: Article;
  image: string;
  subject: string;
  label: string;
};

/** Coarse subject buckets used for visual-diversity checks. */
const SUBJECTS: { subject: string; label: string; test: RegExp }[] = [
  {
    subject: "temple",
    label: "Temple & Spiritual",
    test: /\b(temple|mandir|brahmotsavam|puja|pooja|navaratri|navratri|ugadi|diwali|deepavali|ganesh|bhajan|spiritual|swami)\b/i,
  },
  {
    subject: "events",
    label: "Events",
    test: /\b(festival|celebration|concert|show|mela|fair|program|programme|meet(?:up)?|conference|convention|sammelanam)\b/i,
  },
  {
    subject: "food",
    label: "Food",
    test: /\b(restaurant|food|biryani|cuisine|chef|kitchen|cafe|tiffin|sweets|dosa|menu)\b/i,
  },
  {
    subject: "entertainment",
    label: "Entertainment",
    test: /\b(film|movie|cinema|ott|actress|actor|trailer|teaser|box office|web series|micro ?drama|song|album|music)\b/i,
  },
  {
    subject: "business",
    label: "Business",
    test: /\b(startup|funding|layoff|hiring|jobs|ipo|market|company|tech|ai|semiconductor|real estate|housing|rent|mortgage)\b/i,
  },
  {
    subject: "community",
    label: "Community",
    test: /\b(association|ata|tana|nats|community|volunteer|charity|donation|school|students|parents|seniors|youth)\b/i,
  },
  {
    subject: "people",
    label: "People",
    test: /\b(honou?red|award|appointed|elected|profile|interview|felicitat|wins|named)\b/i,
  },
  {
    subject: "india",
    label: "India",
    test: /\b(hyderabad|amaravati|amaravathi|telangana|andhra|india|delhi|mumbai|chennai|bengaluru)\b/i,
  },
];

/** Which subject bucket a story belongs to, plus its display label. */
export function subjectOf(a: Article): { subject: string; label: string } {
  const text = `${a.title} ${a.excerpt ?? ""}`;
  for (const s of SUBJECTS) {
    if (s.test.test(text)) return { subject: s.subject, label: s.label };
  }
  if (isBayArea(a.title, a.excerpt) || isBayAreaSource(a.sourceUrl)) {
    return { subject: "bay-area", label: "Bay Area" };
  }
  return { subject: a.category || "news", label: a.categoryName || "Latest" };
}

/** Reader-interest cues that lift a story into the hero. */
const INTEREST =
  /\b(h-?1b|green card|visa|immigration|layoff|hiring|housing|rent|school|election|festival|diwali|ugadi|temple|telugu|indian|nri|crash|fire|storm|earthquake|record|first)\b/i;

/**
 * Images unsuitable for a wide editorial hero: extreme portrait crops,
 * screenshots, watermarks, text-heavy cards and low-resolution files.
 */
const HERO_UNSUITABLE =
  /\b(screenshot|screen-?grab|watermark|poster|flyer|thumb|thumbnail|logo|graphic|infographic|chart|whatsapp-image|collage)\b/i;

/** Quality gate: an image must clear this before it may lead the homepage. */
export function heroEligibleImage(url: string | null | undefined): string | null {
  const ok = usableImage(url);
  if (!ok) return null;
  if (!looksHighRes(ok)) return null;
  let readable = ok;
  try {
    readable = decodeURIComponent(new URL(ok).pathname);
  } catch {
    /* keep raw */
  }
  if (HERO_UNSUITABLE.test(readable.replace(/[_%20+]/g, "-"))) return null;
  return ok;
}

/** Editorial score. Higher wins the earlier slide. */
export function heroScore(a: Article, now = new Date()): number {
  let score = 0;
  const text = `${a.title} ${a.excerpt ?? ""}`;
  if (isBayArea(a.title, a.excerpt) || isBayAreaSource(a.sourceUrl)) score += 40;
  if (classifyIndia(a.title, a.excerpt, a.sourceUrl)) score += 8;
  if (INTEREST.test(text)) score += 14;
  if (a.excerpt && a.excerpt.length > 80) score += 6;

  const age = ageInDays(a.date, now);
  if (age <= 0.5) score += 30;
  else if (age <= 1) score += 22;
  else if (age <= 2) score += 14;
  else if (age <= 5) score += 6;
  else score -= 6;

  const image = heroEligibleImage(a.image);
  if (image) score += 18;

  // Least-recently-used: never-shown artwork leads, then the oldest run.
  if (image) {
    const seen = lastUsed(image, "hero");
    if (!seen) score += 12;
    else score -= Math.min(20, timesUsed(image) * 4);
  }
  return score;
}

/**
 * Builds the curated hero set: highest-scoring stories, one per subject, with
 * artwork that is not resting and not already used elsewhere on the page.
 */
export function buildHeroSet(
  articles: Article[],
  options: {
    now?: Date | undefined;
    max?: number | undefined;
    /** Images already spoken for by other homepage slots. */
    exclude?: Set<string> | undefined;
  } = {},
): HeroSlide[] {
  const now = options.now ?? new Date();
  const max = options.max ?? HERO_MAX_SLIDES;
  const exclude = options.exclude ?? new Set<string>();

  const ranked = articles
    .filter((a) => a.category !== "gallery" && a.title)
    .map((a) => ({ a, image: heroEligibleImage(a.image), score: heroScore(a, now) }))
    .filter((c) => !!c.image)
    .sort((x, y) => y.score - x.score);

  const pick = (allowResting: boolean, allowSubjectRepeat: boolean, slides: HeroSlide[]) => {
    const usedImages = new Set(slides.map((s) => s.image));
    const usedSubjects = new Set(slides.map((s) => s.subject));
    const usedSlugs = new Set(slides.map((s) => s.article.slug));
    for (const candidate of ranked) {
      if (slides.length >= max) break;
      const image = candidate.image!;
      if (exclude.has(image) || usedImages.has(image)) continue;
      if (usedSlugs.has(candidate.a.slug)) continue;
      if (!allowResting && isResting(image, "hero", now.getTime())) continue;
      const { subject, label } = subjectOf(candidate.a);
      if (!allowSubjectRepeat && usedSubjects.has(subject)) continue;
      slides.push({ article: candidate.a, image, subject, label });
      usedImages.add(image);
      usedSubjects.add(subject);
      usedSlugs.add(candidate.a.slug);
    }
    return slides;
  };

  // Preferred pass: fresh artwork, one story per subject.
  let slides = pick(false, false, []);
  // Not enough diverse material: relax subject diversity, then the rest window.
  if (slides.length < 3) slides = pick(false, true, slides);
  if (slides.length < 3) slides = pick(true, true, slides);
  return slides.slice(0, max);
}
