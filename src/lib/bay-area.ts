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

/** Local newsrooms and municipal sites whose output is Bay Area by definition. */
const BAY_HOSTS = [
  "mercurynews.com", "eastbaytimes.com", "sfgate.com", "sfchronicle.com",
  "sfstandard.com", "sfexaminer.com", "paloaltoonline.com", "mv-voice.com",
  "almanacnews.com", "padailypost.com", "kron4.com", "ktvu.com",
  "abc7news.com", "nbcbayarea.com", "cbsnews.com/sanfrancisco",
  "sanjoseinside.com", "sanjosespotlight.com", "bayareanewsgroup.com",
  "berkeleyside.org", "smdailyjournal.com", "pleasantonweekly.com",
  "danvillesanramon.com", "sanjoseca.gov", "fremont.gov", "cityofpaloalto.org",
  "redwoodcity.org", "sunnyvale.ca.gov", "santaclaraca.gov", "dublin.ca.gov",
  "cityofpleasantonca.gov", "morganhill.ca.gov", "milpitas.gov", "sfgov.org",
  "eventbrite.com/d/ca--san-francisco", "eventbrite.com/d/ca--san-jose",
];

/** True when the link points at a Bay Area newsroom or city site. */
export function isBayAreaSource(url?: string | null): boolean {
  const u = (url ?? "").toLowerCase();
  if (!u) return false;
  if (BAY_HOSTS.some((h) => u.includes(h))) return true;
  // Patch runs one town site per city: patch.com/california/<town>
  const patch = /patch\.com\/california\/([a-z-]+)/.exec(u);
  return Boolean(patch && isBayArea(patch[1]!.replace(/-/g, " ")));
}
