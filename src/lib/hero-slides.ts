import credaiHero from "@/assets/hyderabad-skyline.jpg";
import sky1 from "@/assets/ads/epaper-skyscraper-1.jpg.asset.json";
import sky2 from "@/assets/ads/epaper-skyscraper-2.jpg.asset.json";

/**
 * Sponsor hero carousel slides.
 *
 * Slide 1 is always the CREDAI property-show banner; the slides that follow are
 * full-page (skyscraper) features lifted from the Telugu Times 23rd Anniversary
 * Special edition, so the vertical artwork is shown intact rather than cropped.
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

export const heroSlides: HeroSlide[] = [
  {
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
  },
  {
    id: "anniv-skyscraper-1",
    type: "skyscraper_feature",
    sponsorName: "My Home Group · My Home Udyan",
    title: "The Park Life — premium homes at Tellapur",
    subtitle: "Featured in the Telugu Times 23rd Anniversary Special",
    imageUrl: sky1.url,
    ctaText: "View Details",
    linkUrl: EPAPER_ANNIVERSARY_URL,
    highlights: ["2, 2.5, 3 & 4 BHK · 1350–2915 sq.ft.", "24.12 acres · 80% open area"],
    tint: "#b2c9d6",
  },
  {
    id: "anniv-skyscraper-2",
    type: "skyscraper_feature",
    sponsorName: "PNG Jewelers",
    title: "Ugadi festive collection — Sunnyvale showroom",
    subtitle: "Featured in the Telugu Times 23rd Anniversary Special",
    imageUrl: sky2.url,
    ctaText: "Learn More",
    linkUrl: EPAPER_ANNIVERSARY_URL,
    highlights: ["40% off diamond jewellery making charges", "791 E El Camino Real, Sunnyvale CA"],
    tint: "#ac8264",
  },
];
