import { CITY_REGIONS } from "@/lib/content";

/**
 * Directory listings arrive from WordPress with the city buried in the
 * address line, so we resolve each listing to one of the 16 Bay Area cities
 * and to its region. Aliases cover neighbourhoods and common spellings.
 */
const ALIASES: Record<string, string[]> = {
  "San Jose": ["san jose", "sanjose", "evergreen", "berryessa", "willow glen", "almaden", "95123", "95148", "95132"],
  "Santa Clara": ["santa clara", "95050", "95051"],
  Sunnyvale: ["sunnyvale", "94085", "94086", "94087"],
  Milpitas: ["milpitas", "95035"],
  Cupertino: ["cupertino", "95014"],
  Gilroy: ["gilroy", "95020"],
  Fremont: ["fremont", "newark ca", "94536", "94538", "94539", "94555"],
  "Union City": ["union city", "94587"],
  Pleasanton: ["pleasanton", "94566", "94588"],
  Dublin: ["dublin", "94568"],
  Livermore: ["livermore", "94550", "94551"],
  "San Ramon": ["san ramon", "danville", "94582", "94583"],
  Oakland: ["oakland", "berkeley", "emeryville", "alameda", "94601", "94612"],
  "Palo Alto": ["palo alto", "menlo park", "redwood city", "94301", "94303", "94306"],
  "Mountain View": ["mountain view", "los altos", "94040", "94041", "94043"],
  "San Francisco": ["san francisco", "s.f.", " sf ", "daly city", "94102", "94110"],
};

export const CITY_TO_REGION: Record<string, string> = Object.fromEntries(
  CITY_REGIONS.flatMap((r) => r.cities.map((c) => [c.en, r.en] as const)),
);

/** Best-effort city for a listing; null when nothing in the text matches. */
export function resolveCity(...parts: (string | null | undefined)[]): string | null {
  const hay = ` ${parts.filter(Boolean).join(" ").toLowerCase().replace(/\s+/g, " ")} `;
  let best: { city: string; at: number } | null = null;
  for (const [city, keys] of Object.entries(ALIASES)) {
    for (const k of keys) {
      const at = hay.indexOf(k);
      if (at >= 0 && (!best || at < best.at)) best = { city, at };
    }
  }
  return best?.city ?? null;
}

export function regionOf(city: string | null): string {
  return (city && CITY_TO_REGION[city]) || "Elsewhere in the Bay Area";
}