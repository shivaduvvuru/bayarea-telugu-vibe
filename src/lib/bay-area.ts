/**
 * Client-safe Bay Area relevance test.
 *
 * Collected feeds mix Indian, national and other-metro items into the same
 * pools. Sections that must stay local (Events, prime story) require a positive
 * Bay Area signal instead of only filtering India coverage out.
 */

const BAY_TERMS = [
  "bay area", "san francisco", "sf bay", "south bay", "east bay", "north bay",
  "peninsula", "silicon valley", "tri-valley", "tri valley",
  "san jose", "santa clara", "sunnyvale", "milpitas", "cupertino", "gilroy",
  "fremont", "newark", "union city", "hayward", "san leandro", "pleasanton",
  "dublin", "livermore", "san ramon", "danville", "oakland", "berkeley",
  "alameda", "emeryville", "palo alto", "menlo park", "redwood city",
  "san mateo", "burlingame", "foster city", "mountain view", "los altos",
  "los gatos", "campbell", "saratoga", "morgan hill", "daly city",
  "south san francisco", "walnut creek", "concord", "fairfield", "vallejo",
  "santa cruz", "half moon bay", "sausalito", "san bruno", "brisbane",
];

/** True when any provided text mentions a Bay Area place. */
export function isBayArea(...parts: (string | null | undefined)[]): boolean {
  const hay = ` ${parts.filter(Boolean).join(" ").toLowerCase().replace(/\s+/g, " ")} `;
  return BAY_TERMS.some((t) => hay.includes(t));
}
