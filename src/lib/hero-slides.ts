import credaiHero from "@/assets/hyderabad-skyline.jpg";

/**
 * Sponsor hero carousel slides.
 *
 * Slide 1 is always the CREDAI property-show banner; every slide after it is a
 * single skyscraper property feature from the Telugu Times 23rd Anniversary
 * Special edition, shown full-page so the vertical artwork stays intact.
 *
 * The carousel rotates slowly on purpose — one slide every 30 minutes — so a
 * sponsor page holds the slot long enough to be read.
 */
export interface HeroSlide {
  id: string;
  type: "banner" | "skyscraper_feature";
  title: string;
  subtitle?: string;
  imageUrl: string;
  linkUrl?: string;
  ctaText?: string;
  sponsorName?: string;
  isCredai?: boolean;
  /** Highlight bullets shown in the context column. */
  highlights?: string[];
  /** Dominant artwork colour, used for the blurred backdrop. */
  tint?: string;
}

export const EPAPER_ANNIVERSARY_URL =
  "https://www.telugutimes.net/epaper/16-31-23rd-anniv-special";

/** Rotation interval for the sponsor carousel: one slide every 30 minutes. */
export const SPONSOR_ROTATE_MS = 30 * 60 * 1000;


const credaiSlide: HeroSlide = {
  id: "credai-main",
  type: "banner",
  title: "CREDAI Hyderabad Property Show & Features",
  subtitle: "Connecting NRI investors with premier real estate opportunities",
  imageUrl: credaiHero,
  ctaText: "Explore Projects",
  linkUrl: "/property/credai-hyderabad-2026",
  isCredai: true,
  sponsorName: "CREDAI Hyderabad",
  highlights: ["Aug 28–30, 2026 · HITEX Hyderabad", "NRI buying desk & verified builders"],
  tint: "#4c4b51",
};

/**
 * Hero-size property slides: every skyscraper feature page of the anniversary
 * edition follows the CREDAI banner, one slide every 30 minutes.
 */
const propertySlides: HeroSlide[] = PROPERTY_FEATURES.map((p) => ({
  id: `property-${p.id}`,
  type: "skyscraper_feature",
  title: p.project,
  subtitle: p.location,
  imageUrl: propertyImage(p.id),
  linkUrl: "/property",
  ctaText: "View all projects",
  sponsorName: p.developer,
  highlights: p.note ? [p.note] : undefined,
  tint: "#26262b",
}));

export const heroSlides: HeroSlide[] = [credaiSlide, ...propertySlides];

