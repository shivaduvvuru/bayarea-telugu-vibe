import { PARENT_SITE } from "@/lib/site";

/**
 * The wider Telugu Times network. Kept in one place so the header, footer and
 * house ads always point at the same profiles.
 */
export const TT_LINKS = {
  site: PARENT_SITE,
  bayarea: "https://bayarea.telugutimes.net",
  epaper: "https://www.telugutimes.net/epaper",
  youtube: "https://www.youtube.com/@telugutimesdigital",
  instagram: "https://www.instagram.com/telugutimesdigital/",
  facebook: "https://www.facebook.com/TeluguTimesDigital/",
  x: "https://x.com/telugutimes",
  whatsapp: "https://whatsapp.com/channel/telugutimes",
} as const;
