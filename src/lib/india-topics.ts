/**
 * Client-safe topic classifier for India coverage.
 *
 * Stories collected from Indian publishers, immigration desks and diaspora
 * outlets all landed in one undifferentiated "news" bucket. This splits them
 * into the India sections shown in the site menu.
 */

export const INDIA_PARENT = "india-news";

export const INDIA_SLUGS = [
  "india-national",
  "india-telangana",
  "india-andhra",
  "india-immigration",
  "india-nri",
] as const;

export type IndiaSlug = (typeof INDIA_SLUGS)[number];

const RULES: { slug: IndiaSlug; match: RegExp }[] = [
  {
    slug: "india-immigration",
    match:
      /\bh[- ]?1b\b|\bh4\b|\bl[- ]?1\b|\bo[- ]?1\b|green card|priority date|visa bulletin|uscis|immigrat|consular|visa (?:interview|appointment|fee|denial|rules?)|opt\b|ead\b|naturaliz|citizenship (?:test|application)|deportat|asylum/i,
  },
  {
    slug: "india-telangana",
    match:
      /telangana|hyderabad|secunderabad|cyberabad|hitec city|gachibowli|warangal|karimnagar|nizamabad|khammam|hydraa|brs\b|kcr\b|\bktr\b|revanth|harish rao|kavitha|bhatti vikramarka/i,
  },
  {
    slug: "india-andhra",
    match:
      /andhra|amaravati|\bcrda\b|vijayawada|visakhapatnam|vizag|guntur|tirupati|kurnool|nellore|kakinada|anantapur|kadapa|rajahmundry|tdp\b|ysrcp|jagan|chandrababu|pawan kalyan/i,
  },
  {
    slug: "india-nri",
    match:
      /\bnri\b|\boci\b|\bpio\b|diaspora|indian[- ]american|indian american|indians in (?:the )?(?:us|usa|america)|remittance|pravasi|india abroad/i,
  },
];

/**
 * Returns the India section slug for a story, or null when it is not India
 * coverage (Bay Area local reporting, cinema, temples, events).
 */
export function classifyIndia(
  title: string | null | undefined,
  summary?: string | null,
  sourceUrl?: string | null,
): IndiaSlug | null {
  const text = `${title ?? ""} ${summary ?? ""}`;
  for (const rule of RULES) if (rule.match.test(text)) return rule.slug;

  const host = (sourceUrl ?? "").toLowerCase();
  const indianPublisher =
    /indiatimes|thehindu|ndtv|indiatoday|outlookindia|theweek\.in|frontline|indiawest|newindiaabroad|americanbazaar|telugutimes\.net|murthy\.com|immigration\.com|uscis\.gov|indianembassy|cgisf/.test(
      host,
    );
  const indiaText = /\bindia\b|\bindian\b|new delhi|modi\b|lok sabha|rupee|\bbharat\b/i.test(text);

  if (indianPublisher || indiaText) return "india-national";
  return null;
}
