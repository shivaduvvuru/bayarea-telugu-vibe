import { BAY_AREA, CITIES, type City } from "./desk-cities";
import { dedupeKey } from "./dedupe";
import { usableImage } from "./story-image";
import { resolveGoogleNewsUrls } from "./google-news.server";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { generateText } from "ai";

export type CollectedItem = {
  dedupe_key: string;
  item_id: string;
  digest_date: string;
  kind: "news" | "event" | "temple";
  city_slug: string;
  title: string;
  summary: string;
  source: string;
  source_url: string;
  published_at: string | null;
  origin: "feed";
  payload: Record<string, unknown>;
};

const MAX_PER_CITY = 6;

const EVENT_WORDS = /\b(festival|event|concert|mela|fair|parade|workshop|meetup|celebration|camp|tournament|show)\b/i;
const TEMPLE_WORDS = /\b(temple|mandir|puja|pooja|abhishekam|hindu|devotee|swami|gurudwara|bhajan)\b/i;

function classify(title: string): CollectedItem["kind"] {
  if (TEMPLE_WORDS.test(title)) return "temple";
  if (EVENT_WORDS.test(title)) return "event";
  return "news";
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Stable, short, collision-safe-enough key so the same story is never stored twice. */
function keyFor(citySlug: string, title: string) {
  const base = `${citySlug}:${normalize(title)}`;
  let h1 = 2166136261;
  let h2 = 5381;
  for (let i = 0; i < base.length; i++) {
    h1 ^= base.charCodeAt(i);
    h1 = Math.imul(h1, 16777619);
    h2 = (h2 * 33) ^ base.charCodeAt(i);
  }
  return `${citySlug}-${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`;
}

function decodeEntities(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function tag(block: string, name: string) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decodeEntities(m[1]!) : "";
}

type RawItem = {
  title: string;
  link: string;
  source: string;
  published: string | null;
  image: string | null;
};

/** Pulls a usable image URL out of an RSS <item> block. */
/** Numeric/named entities appear inside feed-embedded URLs. */
function cleanUrl(raw: string): string | null {
  const url = raw
    .trim()
    .replace(/&(?:amp|#0*38);/gi, "&")
    .replace(/&#0*58;/g, ":")
    .replace(/&#0*47;/g, "/");
  if (!/^https?:\/\//.test(url)) return null;
  // Patch only serves its own logo as artwork; skip so cards use their tile.
  return usableImage(url);
}

function imageFrom(block: string): string | null {
  const patterns = [
    /<media:content[^>]+url="([^"]+)"/i,
    /<media:thumbnail[^>]+url="([^"]+)"/i,
    /<enclosure[^>]+url="([^"]+)"[^>]*type="image/i,
    /<enclosure[^>]+type="image[^"]*"[^>]*url="([^"]+)"/i,
    /<image[^>]*>[\s\S]*?<url>([^<]+)<\/url>/i,
    /&lt;img[^&]*?src=(?:&quot;|")([^"&]+)/i,
    /<img[^>]+src="([^"]+)"/i,
  ];
  for (const re of patterns) {
    const m = block.match(re);
    const url = m?.[1] ? cleanUrl(m[1]) : null;
    if (url) return url;
  }
  return null;
}

/** MSN renders client-side; its detail API exposes the artwork and origin link. */
async function msnImage(link: string): Promise<string | null> {
  const id = link.match(/\/ar-([A-Za-z0-9]+)/)?.[1];
  if (!id) return null;
  try {
    const res = await fetch(`https://assets.msn.com/content/view/v2/Detail/en-us/${id}`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { imageResources?: { url?: string; width?: number }[] };
    const best = (json.imageResources ?? [])
      .filter((i) => typeof i.url === "string")
      .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
    return best?.url ? cleanUrl(best.url) : null;
  } catch {
    return null;
  }
}

/** Best artwork for a publisher URL (MSN needs its detail API). */
export async function fetchArticleImage(link: string): Promise<string | null> {
  try {
    const host = new URL(link).hostname;
    const found = /(?:^|\.)msn\.com$/.test(host)
      ? ((await msnImage(link)) ?? (await ogImage(link)))
      : await ogImage(link);
    return usableImage(found);
  } catch {
    return null;
  }
}

/**
 * Reads the article page and returns its lead artwork. Meta tags first, then
 * in-body <img> candidates (photo galleries such as 123telugu's slideshows
 * publish no og:image and serve the picture through a relative path).
 */
async function ogImage(link: string): Promise<string | null> {
  try {
    const res = await fetch(link, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 200_000);
    const candidates: string[] = [];
    const meta =
      html.match(/<meta[^>]+property="og:image(?::secure_url)?"[^>]+content="([^"]+)"/i) ??
      html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i) ??
      html.match(/<meta[^>]+name="twitter:image(?::src)?"[^>]+content="([^"]+)"/i) ??
      html.match(/<link[^>]+rel="image_src"[^>]+href="([^"]+)"/i);
    if (meta?.[1]) candidates.push(meta[1]);
    for (const m of html.matchAll(/<img[^>]+src="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi)) {
      if (m[1]) candidates.push(m[1]);
      if (candidates.length > 20) break;
    }
    // Prefer the biggest / most editorial-looking candidate over the first hit.
    const scored: { url: string; score: number }[] = [];
    for (const raw of candidates) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      let abs: string;
      try {
        abs = trimmed.startsWith("//")
          ? `https:${trimmed}`
          : new URL(trimmed, res.url || link).toString();
      } catch {
        continue;
      }
      const usable = cleanUrl(abs);
      if (!usable) continue;
      let score = 0;
      if (/(?:large|full|original|1200|1080|orig|hd)/i.test(usable)) score += 3;
      if (/\/(?:images?|photos?|uploads?|gallery)\//i.test(usable)) score += 1;
      if (/\.(?:jpg|jpeg)(?:$|\?)/i.test(usable)) score += 1;
      if (candidates[0] === raw) score += 2; // og:image is usually the lead art
      scored.push({ url: usable, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.url ?? null;
  } catch {
    return null;
  }
}


/** Search feeds wrap the real article URL in a redirect; unwrap when possible. */
function unwrapLink(link: string): string {
  try {
    const u = new URL(link);
    const inner = u.searchParams.get("url") ?? u.searchParams.get("u");
    if (inner && /^https?:\/\//.test(inner)) return inner;
  } catch {
    /* keep original */
  }
  return link;
}

function parseRss(xml: string): RawItem[] {
  const out: RawItem[] = [];
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  for (const b of blocks) {
    const rawTitle = tag(b, "title");
    if (!rawTitle) continue;
    const source = tag(b, "source") || rawTitle.split(" - ").slice(-1)[0] || "Web";
    const title = rawTitle
      .replace(new RegExp(`\\s-\\s${source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), "")
      // Aggregator newsletter prefixes ("Patch AM:", "SF:") add nothing.
      .replace(/^(?:patch\s*(?:am|pm)|sf|sj|nyc)\s*:\s*/i, "")
      .trim();
    const pub = tag(b, "pubDate");
    out.push({
      title,
      link: unwrapLink(tag(b, "link")),
      source,
      published: pub ? new Date(pub).toISOString() : null,
      image: imageFrom(b),
    });
  }
  return out;
}

/** Diagnostics for the last collect run, surfaced by the collect endpoint. */
export const lastDiag = {
  fetched: 0,
  raw: 0,
  kept: 0,
  images: 0,
  duplicates: 0,
  notes: [] as string[],
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function fetchFeed(url: string): Promise<RawItem[] | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, */*" } });
    if (!res.ok) {
      if (lastDiag.notes.length < 6) lastDiag.notes.push(`HTTP ${res.status} ${new URL(url).host}`);
      return null;
    }
    const items = parseRss(await res.text());
    // Google News wraps the publisher URL; unwrapped links show a Google
    // interstitial instead of the story, so resolve them before storing.
    const map = await resolveGoogleNewsUrls(items.map((i) => i.link));
    return map.size ? items.map((i) => ({ ...i, link: map.get(i.link) ?? i.link })) : items;
  } catch (e) {
    if (lastDiag.notes.length < 6)
      lastDiag.notes.push(`${new URL(url).host}: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

async function fetchCity(city: City): Promise<RawItem[]> {
  const queries = [
    `"${city.en}" California city news`,
    `"${city.en}" California Indian OR Telugu OR temple OR community event`,
  ];
  const results = await Promise.all(
    queries.map(async (q) => {
      // Bing News first: its items link straight to the publisher, so we can read
      // the article artwork. Google News is the fallback but hides the real URL.
      let parsed = await fetchFeed(
        `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=RSS&cc=us&setmkt=en-us&setlang=en-us`,
      );
      if (!parsed?.length) {
        parsed =
          (await fetchFeed(
            `https://news.google.com/rss/search?q=${encodeURIComponent(q)}+when:2d&hl=en-US&gl=US&ceid=US:en`,
          )) ?? parsed;
      }
      if (!parsed) return [];
      lastDiag.fetched += 1;
      lastDiag.raw += parsed.length;
      return parsed;
    }),
  );
  const LOCAL_SOURCES =
    /mercury news|east bay times|sfgate|san francisco chronicle|sf standard|sfist|san jose spotlight|palo alto online|mv voice|the almanac|pleasanton weekly|berkeleyside|oaklandside|hoodline|kqed|abc7|ktvu|kron4|nbc bay area|cbs news bay area|bay area news group|marin independent|bay city news|patch|dispatch|weekly|telugu/;
  const CA_HINT = /california|bay area|silicon valley|calif|, ca |ca \(/;
  const JUNK = /obituary|obituaries|death notice|horoscope|lottery|box score|highlights/;
  const cityWords = normalize(city.en);
  const local = (item: RawItem) => {
    const hay = normalize(`${item.title} ${item.source}`);
    if (JUNK.test(hay)) return false;
    if (!hay.includes(cityWords)) return false;
    return CA_HINT.test(hay) || LOCAL_SOURCES.test(hay);
  };


  const seen = new Set<string>();
  const merged: RawItem[] = [];
  for (const item of results.flat()) {
    const k = normalize(item.title);
    if (!k || seen.has(k) || !local(item)) continue;
    seen.add(k);
    merged.push(item);
    if (merged.length >= MAX_PER_CITY) break;
  }
  await addImages(merged);

  lastDiag.kept += merged.length;
  return merged;

}

/** Feeds rarely carry artwork, so read the article page for og:image. */
async function addImages(items: RawItem[]): Promise<void> {
  await Promise.all(
    items.map(async (item) => {
      // Patch only ever exposes its own "Patch AM" logo, so skip artwork here
      // and let the story render as a typographic card.
      if (/patch/i.test(item.source) || /patch\.com/i.test(item.link)) {
        item.image = null;
        return;
      }
      if (!item.image && item.link) {
        try {
          const host = new URL(item.link).hostname;
          item.image = /(?:^|\.)msn\.com$/.test(host)
            ? ((await msnImage(item.link)) ?? (await ogImage(item.link)))
            : await ogImage(item.link);
        } catch {
          /* unusable link */
        }
      }
      if (item.image) lastDiag.images += 1;
      else if (lastDiag.notes.length < 8) lastDiag.notes.push(`no image: ${item.link.slice(0, 70)}`);
    }),
  );
}

/**
 * Region-wide topics Bay Area Telugu readers care about: NRI/immigration and
 * India-US news, Telugu community events, and temple announcements.
 */
const TOPIC_GROUPS: { kind: CollectedItem["kind"]; queries: string[]; match: RegExp }[] = [
  // Temple first: a story that reads as both temple and event should file as temple.
  {
    kind: "temple",
    queries: [
      "Hindu temple Bay Area California event OR festival",
      "Shiva Vishnu Temple Livermore OR Fremont Hindu temple news",
      "Balaji OR Venkateswara temple California utsavam OR abhishekam",
    ],
    match: /temple|mandir|hindu|puja|pooja|abhishek|utsav|balaji|venkateswara|swami|devotee/,
  },
  {
    kind: "event",
    queries: [
      "Telugu OR Indian community event Bay Area California",
      "TANA OR ATA OR NATS Telugu association event",
      "Ugadi OR Diwali OR Sankranti OR Kuchipudi event Bay Area",
    ],
    match: /telugu|indian|india|ugadi|diwali|sankranti|kuchipudi|carnatic|tana|nats|event|festival|concert/,
  },
  {
    kind: "news",
    queries: [
      "H-1B visa OR green card backlog Indian immigrants news",
      "NRI India US news Telugu community California",
      "Indian consulate San Francisco OR OCI OR India visa news",
      "Telangana OR Andhra Pradesh news United States diaspora",
    ],
    match: /h 1b|h1b|green card|visa|immigrat|nri|india|indian|telugu|telangana|andhra|consulate|diaspora/,
  },
  // Indian cinema: Telugu (Tollywood) and Hindi (Bollywood) releases, reviews,
  // box office and theatre listings that Bay Area readers follow.
  {
    kind: "news",
    queries: [
      "Telugu cinema Tollywood movie news release box office",
      "Tollywood Telugu movie review OTT release update",
      "Bollywood Hindi movie news release review box office",
      "Telugu OR Hindi movie US premiere theatres Bay Area California",
      "Tollywood OR Bollywood actor film shooting update",
    ],
    match:
      /tollywood|bollywood|telugu (?:film|movie|cinema)|hindi (?:film|movie|cinema)|box office|teaser|trailer|first look|premiere|movie review|actor|actress|director|ott release/,
  },
];

const TOPIC_MAX = 8;

async function fetchTopics(
  group: (typeof TOPIC_GROUPS)[number],
): Promise<RawItem[]> {
  const JUNK = /obituary|obituaries|death notice|horoscope|lottery|box score/;
  const results = await Promise.all(
    group.queries.map(async (q) => {
      let parsed = await fetchFeed(
        `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=RSS&cc=us&setmkt=en-us&setlang=en-us`,
      );
      if (!parsed?.length) {
        parsed =
          (await fetchFeed(
            `https://news.google.com/rss/search?q=${encodeURIComponent(q)}+when:7d&hl=en-US&gl=US&ceid=US:en`,
          )) ?? parsed;
      }
      if (!parsed) return [];
      lastDiag.fetched += 1;
      lastDiag.raw += parsed.length;
      return parsed;
    }),
  );
  const seen = new Set<string>();
  const merged: RawItem[] = [];
  for (const item of results.flat()) {
    const hay = normalize(`${item.title} ${item.source}`);
    const k = normalize(item.title);
    if (!k || seen.has(k) || JUNK.test(hay) || !group.match.test(hay)) continue;
    seen.add(k);
    merged.push(item);
    if (merged.length >= TOPIC_MAX) break;
  }
  await addImages(merged);
  lastDiag.kept += merged.length;
  return merged;
}

/**
 * Named publishers we read directly rather than through a news search:
 * Indian-American papers, national Indian dailies and magazines, plus official
 * immigration sources (USCIS newsroom, Murthy Law Firm, Immigration.com).
 * Publishers without a working RSS feed are read through a site: news search.
 */
const PUBLISHER_FEEDS: {
  name: string;
  url: string;
  kind: CollectedItem["kind"];
  limit?: number;
  match?: RegExp;
}[] = [
  // Indian-American press
  { name: "New India Abroad", url: "https://news.google.com/rss/search?q=site:newindiaabroad.com+when:7d&hl=en-US&gl=US&ceid=US:en", kind: "news", limit: 5 },
  { name: "India West", url: "https://news.google.com/rss/search?q=site:indiawest.com+when:7d&hl=en-US&gl=US&ceid=US:en", kind: "news", limit: 5 },
  { name: "The American Bazaar", url: "https://americanbazaaronline.com/feed/", kind: "news", limit: 5 },
  // Indian national dailies and magazines
  { name: "The Times of India (NRI)", url: "https://timesofindia.indiatimes.com/rssfeeds/7098551.cms", kind: "news", limit: 5 },
  { name: "NDTV India", url: "https://feeds.feedburner.com/ndtvnews-india-news", kind: "news", limit: 4 },
  { name: "The Hindu", url: "https://www.thehindu.com/news/national/feeder/default.rss", kind: "news", limit: 4 },
  {
    name: "Indian magazines",
    url: "https://news.google.com/rss/search?q=(site:frontline.thehindu.com+OR+site:indiatoday.in+OR+site:outlookindia.com+OR+site:theweek.in)+India+when:7d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 4,
  },
  // Immigration and consular
  {
    name: "USCIS",
    url: "https://www.uscis.gov/news/rss-feed/59144",
    kind: "news",
    limit: 6,
    match: /visa|green card|h 1b|h1b|immigrat|citizenship|naturaliz|form i|uscis|fee|eb 2|eb 3|opt|status/,
  },
  { name: "Murthy Law Firm", url: "https://www.murthy.com/feed/", kind: "news", limit: 5 },
  { name: "Immigration.com", url: "https://www.immigration.com/rss.xml", kind: "news", limit: 5 },
  // Telugu cinema trade desks — filed under Cinema, photo-led stories also
  // surface in Gallery.
  { name: "123Telugu", url: "https://www.123telugu.com/feed", kind: "news", limit: 6 },
  { name: "Gulte", url: "https://www.gulte.com/feed", kind: "news", limit: 5 },
  { name: "GreatAndhra", url: "https://www.greatandhra.com/rss/rssfeed.php", kind: "news", limit: 5 },
  {
    name: "Telugu cinema",
    url: "https://news.google.com/rss/search?q=Telugu+cinema+OR+Tollywood+movie+news+when:7d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 6,
  },
  // Star / photo desks — these feed the Gallery picture grid.
  {
    name: "123Telugu Gallery",
    url: "https://www.123telugu.com/category/gallery/feed",
    kind: "news",
    limit: 8,
  },
  {
    name: "Heroine galleries",
    url: "https://news.google.com/rss/search?q=(%22actress+gallery%22+OR+%22heroine+photos%22+OR+%22latest+stills%22+OR+%22photo+gallery%22)+(Telugu+OR+Tollywood+OR+Bollywood)+when:7d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 8,
  },
  {
    name: "Tollywood stars",

    url: "https://news.google.com/rss/search?q=(Tollywood+OR+%22Telugu+actress%22+OR+%22Telugu+heroine%22)+(photos+OR+stills+OR+glamour+OR+%22new+look%22+OR+%22photo+shoot%22)+when:7d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 6,
  },
  {
    name: "Bollywood stars",
    url: "https://news.google.com/rss/search?q=(Bollywood+actress+OR+%22Hindi+film+actress%22)+(photos+OR+stills+OR+%22red+carpet%22+OR+%22new+look%22+OR+%22photo+shoot%22)+when:7d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 6,
  },
  {
    name: "OTT & streaming",
    url: "https://news.google.com/rss/search?q=(OTT+OR+Netflix+OR+%22Prime+Video%22+OR+Aha+OR+Hotstar)+(Telugu+OR+Hindi)+(web+series+OR+film+OR+release+OR+trailer)+when:7d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 6,
  },
  { name: "Pinkvilla", url: "https://www.pinkvilla.com/rss.xml", kind: "news", limit: 5 },
  {
    name: "Bollywood Hungama",
    url: "https://www.bollywoodhungama.com/feed/",
    kind: "news",
    limit: 5,
  },
  // Telugu-language cinema and star coverage (Telugu script headlines).
  {
    name: "తెలుగు సినిమా",
    url: "https://news.google.com/rss/search?q=%E0%B0%B8%E0%B0%BF%E0%B0%A8%E0%B0%BF%E0%B0%AE%E0%B0%BE+OR+%E0%B0%9F%E0%B0%BE%E0%B0%B2%E0%B1%80%E0%B0%B5%E0%B1%81%E0%B0%A1%E0%B1%8D+when:7d&hl=te&gl=IN&ceid=IN:te",
    kind: "news",
    limit: 6,
  },
  {
    name: "తెలుగు హీరోయిన్లు",
    url: "https://news.google.com/rss/search?q=%E0%B0%B9%E0%B1%80%E0%B0%B0%E0%B1%8B%E0%B0%AF%E0%B0%BF%E0%B0%A8%E0%B1%8D+OR+%E0%B0%A8%E0%B0%9F%E0%B0%BF+%E0%B0%AB%E0%B1%8B%E0%B0%9F%E0%B1%8B%E0%B0%B2%E0%B1%81+when:7d&hl=te&gl=IN&ceid=IN:te",
    kind: "news",
    limit: 6,
  },
  {
    name: "ఓటీటీ",
    url: "https://news.google.com/rss/search?q=%E0%B0%92%E0%B0%9F%E0%B1%80%E0%B0%9F%E0%B1%80+%E0%B0%B8%E0%B0%BF%E0%B0%A8%E0%B0%BF%E0%B0%AE%E0%B0%BE+OR+%E0%B0%B5%E0%B1%86%E0%B0%AC%E0%B1%8D+%E0%B0%B8%E0%B0%BF%E0%B0%B0%E0%B0%BF%E0%B0%B8%E0%B1%8D+when:7d&hl=te&gl=IN&ceid=IN:te",
    kind: "news",
    limit: 5,
  },


  {
    name: "Consulate General of India, San Francisco",
    url: "https://news.google.com/rss/search?q=%22Consulate+General+of+India%22+San+Francisco+OR+%22Indian+consulate%22+OCI+OR+passport+OR+visa+when:14d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 4,
  },
];

/** Anything older than this is stale for a daily digest. */
const MAX_AGE_DAYS = 12;

function recent(published: string | null): boolean {
  if (!published) return true;
  const t = Date.parse(published);
  if (Number.isNaN(t)) return true;
  return Date.now() - t <= MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

async function fetchPublisher(feed: (typeof PUBLISHER_FEEDS)[number]): Promise<RawItem[]> {
  const parsed = await fetchFeed(feed.url);
  if (!parsed?.length) return [];
  lastDiag.fetched += 1;
  lastDiag.raw += parsed.length;
  // A publisher's own feed carries no <source> tag, so parseRss falls back to the
  // headline — always label those with the configured publisher name instead.
  const aggregated = /news\.google\.com|bing\.com/.test(feed.url);
  const seen = new Set<string>();
  const merged: RawItem[] = [];
  for (const item of parsed) {
    const k = normalize(item.title);
    const hay = normalize(`${item.title} ${item.source}`);
    if (!k || seen.has(k) || !recent(item.published)) continue;
    if (feed.match && !feed.match.test(hay)) continue;
    seen.add(k);
    merged.push({ ...item, source: aggregated ? item.source || feed.name : feed.name });
    if (merged.length >= (feed.limit ?? 4)) break;
  }
  await addImages(merged);
  lastDiag.kept += merged.length;
  return merged;
}

export let lastAiError: string | null = null;

async function summarize(city: City, items: RawItem[], apiKey: string | undefined): Promise<string[]> {

  const fallback = items.map(
    (i) => `${i.source} report for ${city.en}. Verify details and add the Telugu translation before publishing.`,
  );
  if (!items.length) return fallback;
  if (!apiKey) {
    lastAiError = "LOVABLE_API_KEY missing at runtime";
    return fallback;
  }

  try {
    const gateway = createLovableAiGatewayProvider(apiKey);
    const { text } = await generateText({
      model: gateway("google/gemini-3.1-flash-lite"),
      prompt:
        `You write short editorial notes for a Telugu-American community news desk in ${city.en}, California.\n` +
        `For each numbered headline below, write ONE neutral sentence (max 28 words) explaining what it means for local residents. Do not invent facts beyond the headline.\n` +
        `Reply with exactly ${items.length} lines, each formatted as "<number>. <sentence>". No other text.\n\n` +
        items.map((it, i) => `${i + 1}. ${it.title} (${it.source})`).join("\n"),
    });
    const map = new Map<number, string>();
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*(\d+)[.)]\s*(.+)$/);
      if (m) map.set(Number(m[1]) - 1, m[2]!.trim());
    }
    if (map.size) lastAiError = null;
    return items.map((_, i) => map.get(i) ?? fallback[i]!);

  } catch (e) {
    lastAiError = e instanceof Error ? e.message : String(e);
    console.error("summarize failed", e);

    return fallback;
  }
}

/** Collect fresh items for every city. Returns rows ready for a dedupe-safe upsert. */
export async function collectAll(apiKey: string | undefined): Promise<CollectedItem[]> {
  const today = new Date().toISOString().slice(0, 10);
  const rows: CollectedItem[] = [];
  lastDiag.fetched = 0;
  lastDiag.raw = 0;
  lastDiag.kept = 0;
  lastDiag.images = 0;
  lastDiag.duplicates = 0;
  lastDiag.notes = [];


  for (let b = 0; b < CITIES.length; b += 4) {
    const batch = CITIES.slice(b, b + 4);
    const collected = await Promise.all(
      batch.map(async (city) => {
        const items = await fetchCity(city);
        const summaries = await summarize(city, items, apiKey);
        return items.map((it, i) => {
          const kind = classify(it.title);
          const dedupe = keyFor(city.slug, it.title);
          return {
            dedupe_key: dedupe,
            item_id: dedupe,
            digest_date: (it.published ?? `${today}T00:00:00Z`).slice(0, 10),
            kind,
            city_slug: city.slug,
            title: it.title,
            summary: summaries[i] ?? "",
            source: it.source,
            source_url: it.link,
            published_at: it.published,
            origin: "feed" as const,
            payload: {
              id: dedupe,
              kind,
              citySlug: city.slug,
              title: it.title,
              summary: summaries[i] ?? "",
              source: it.source,
              sourceUrl: it.link,
              image: it.image,
              collectedAt: today,
            },
          } satisfies CollectedItem;
        });
      }),
    );
    rows.push(...collected.flat());
  }

  // Region-wide NRI, community-event and temple items.
  const topicRows = await Promise.all(
    TOPIC_GROUPS.map(async (group) => {
      const items = await fetchTopics(group);
      const summaries = await summarize(BAY_AREA, items, apiKey);
      return items.map((it, i) => {
        const dedupe = keyFor(BAY_AREA.slug, it.title);
        return {
          dedupe_key: dedupe,
          item_id: dedupe,
          digest_date: (it.published ?? `${today}T00:00:00Z`).slice(0, 10),
          kind: group.kind,
          city_slug: BAY_AREA.slug,
          title: it.title,
          summary: summaries[i] ?? "",
          source: it.source,
          source_url: it.link,
          published_at: it.published,
          origin: "feed" as const,
          payload: {
            id: dedupe,
            kind: group.kind,
            citySlug: BAY_AREA.slug,
            title: it.title,
            summary: summaries[i] ?? "",
            source: it.source,
            sourceUrl: it.link,
            image: it.image,
            collectedAt: today,
          },
        } satisfies CollectedItem;
      });
    }),
  );
  rows.push(...topicRows.flat());

  // Named publishers read directly: Indian-American papers, Indian dailies and
  // magazines, and official immigration sources.
  const publisherRows = await Promise.all(
    PUBLISHER_FEEDS.map(async (feed) => {
      const items = await fetchPublisher(feed);
      const summaries = await summarize(BAY_AREA, items, apiKey);
      return items.map((it, i) => {
        const dedupe = keyFor(BAY_AREA.slug, it.title);
        const kind = feed.kind === "news" ? classify(it.title) : feed.kind;
        return {
          dedupe_key: dedupe,
          item_id: dedupe,
          digest_date: (it.published ?? `${today}T00:00:00Z`).slice(0, 10),
          kind,
          city_slug: BAY_AREA.slug,
          title: it.title,
          summary: summaries[i] ?? "",
          source: it.source || feed.name,
          source_url: it.link,
          published_at: it.published,
          origin: "feed" as const,
          payload: {
            id: dedupe,
            kind,
            citySlug: BAY_AREA.slug,
            title: it.title,
            summary: summaries[i] ?? "",
            source: it.source || feed.name,
            sourceUrl: it.link,
            image: it.image,
            collectedAt: today,
          },
        } satisfies CollectedItem;
      });
    }),
  );
  rows.push(...publisherRows.flat());


  // Temple announcements come from each temple's own website, not news search —
  // news feeds almost never carry seva / utsavam notices.
  try {
    const { fetchAllTemples } = await import("./temples.server");
    const temples = await fetchAllTemples();
    for (const t of temples) {
      const slug =
        CITIES.find((c) => c.en.toLowerCase() === t.source.city.toLowerCase())?.slug ??
        BAY_AREA.slug;
      for (const a of t.announcements.slice(0, 4)) {
        const dedupe = keyFor(slug, `${t.source.name} ${a.title}`);
        rows.push({
          dedupe_key: dedupe,
          item_id: dedupe,
          digest_date: today,
          kind: "temple",
          city_slug: slug,
          title: `${a.title} — ${t.source.name}`,
          summary: `${t.source.name}, ${t.source.city}. ${a.date ? `Listed for ${a.date}. ` : ""}Confirm timings with the temple before publishing.`,
          source: t.source.name,
          source_url: a.url || t.source.site,
          published_at: null,
          origin: "feed" as const,
          payload: {
            id: dedupe,
            kind: "temple",
            citySlug: slug,
            title: `${a.title} — ${t.source.name}`,
            summary: `${t.source.name}, ${t.source.city}.`,
            source: t.source.name,
            sourceUrl: a.url || t.source.site,
            ...(a.date ? { when: a.date } : {}),
            venue: t.source.name,
            collectedAt: today,
          },
        } as CollectedItem);
      }
    }
  } catch (e) {
    lastDiag.notes.push(`temple pull failed: ${e instanceof Error ? e.message : String(e)}`);
  }



  return dedupeCollected(rows);
}

/** Canonical form of an article URL: no protocol, www, query string or trailing slash. */
export function urlKey(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}

/**
 * Collapses the same story appearing under several cities, feeds or slightly
 * different headlines. `existing` carries title/url keys already stored from
 * previous days so a re-published headline never lands twice.
 */
export function dedupeCollected(
  rows: CollectedItem[],
  existing?: { titles?: Iterable<string>; urls?: Iterable<string> },
): CollectedItem[] {
  const seenKey = new Set<string>();
  const seenTitle = new Set(existing?.titles ?? []);
  const seenUrl = new Set(existing?.urls ?? []);
  const unique: CollectedItem[] = [];
  for (const r of rows) {
    const tk = dedupeKey(r.title);
    const uk = r.source_url ? urlKey(r.source_url) : "";
    if (seenKey.has(r.dedupe_key) || (tk && seenTitle.has(tk)) || (uk && seenUrl.has(uk))) {
      lastDiag.duplicates += 1;
      continue;
    }
    seenKey.add(r.dedupe_key);
    if (tk) seenTitle.add(tk);
    if (uk) seenUrl.add(uk);
    unique.push(r);
  }
  return unique;
}
