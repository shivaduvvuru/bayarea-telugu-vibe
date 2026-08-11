/**
 * Political news sources. Independent of WordPress: each entry is a Google
 * News RSS query, so city-hall coverage and Indian political news arrive
 * straight from the publishers rather than through the parent site.
 */
import { CITY_REGIONS } from "./content";

export type PoliticsSource = {
  id: string;
  /** "San Jose" or "Andhra Pradesh" */
  name: string;
  /** Grouping shown on the page. */
  region: string;
  scope: "local" | "india";
  url: string;
};

function googleNews(query: string) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
}

/** City hall, council, mayor and election coverage for each of the 16 cities. */
const LOCAL: PoliticsSource[] = CITY_REGIONS.flatMap((region) =>
  region.cities.map((city) => ({
    id: `city:${city.slug}`,
    name: city.en,
    region: region.en,
    scope: "local" as const,
    url: googleNews(
      `"${city.en}" California (mayor OR "city council" OR election OR "board of supervisors" OR ballot OR councilmember)`,
    ),
  })),
);

/**
 * Indian politics with the strongest pull for Bay Area Telugu readers:
 * the two Telugu states first, then national politics and the Indian
 * diaspora angle in US politics.
 */
const INDIA: PoliticsSource[] = [
  {
    id: "india:andhra-pradesh",
    name: "Andhra Pradesh",
    region: "Telugu States",
    scope: "india",
    url: googleNews(
      "Andhra Pradesh politics (Chandrababu Naidu OR Jagan Mohan Reddy OR Pawan Kalyan OR TDP OR YSRCP OR Janasena OR assembly)",
    ),
  },
  {
    id: "india:telangana",
    name: "Telangana",
    region: "Telugu States",
    scope: "india",
    url: googleNews(
      "Telangana politics (Revanth Reddy OR KCR OR KTR OR BRS OR Congress OR Hyderabad assembly)",
    ),
  },
  {
    id: "india:national",
    name: "National",
    region: "India",
    scope: "india",
    url: googleNews(
      "India politics (Narendra Modi OR Rahul Gandhi OR Amit Shah OR Parliament OR Lok Sabha OR Election Commission)",
    ),
  },
  {
    id: "india:diaspora",
    name: "Indian-Americans in US Politics",
    region: "India",
    scope: "india",
    url: googleNews(
      '"Indian American" (congress OR senator OR mayor OR "city council" OR candidate OR election) California',
    ),
  },
  {
    id: "india:us-india",
    name: "US–India Relations",
    region: "India",
    scope: "india",
    url: googleNews("US India relations (visa OR H-1B OR trade OR diplomacy OR summit)"),
  },
];

export const POLITICS_SOURCES: PoliticsSource[] = [...LOCAL, ...INDIA];

/** Region order used by the page and the homepage rail. */
export const POLITICS_REGIONS = [
  ...CITY_REGIONS.map((r) => r.en),
  "Telugu States",
  "India",
];