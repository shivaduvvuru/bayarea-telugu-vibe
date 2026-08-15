import { BAY_AREA, CITIES, cityBySlug, type City } from "./desk-cities";
import { dedupeKey } from "./dedupe";
import { usableImage } from "./story-image";
import {
  resolveGoogleNewsUrls,
  resolveGoogleNewsUrl,
  isGoogleNewsUrl,
} from "./google-news.server";
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

const MAX_PER_CITY = 16;

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
  /** Item body text — municipal calendars carry the event date in here. */
  detail?: string;
  /** CivicPlus calendar feeds expose the event date in its own element. */
  eventDates?: string;
  /** True when the item came from a city calendar rather than its newsroom. */
  calendar?: boolean;
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

/**
 * Best artwork for a publisher URL. Google News wrappers serve an interstitial
 * with no artwork, so resolve those to the publisher page first (this is why
 * several city stories ended up with no picture). MSN needs its detail API.
 */
export async function fetchArticleImage(link: string): Promise<string | null> {
  try {
    const target = await resolveGoogleNewsUrl(link);
    if (isGoogleNewsUrl(target)) return null;
    const host = new URL(target).hostname;
    const found = /(?:^|\.)msn\.com$/.test(host)
      ? ((await msnImage(target)) ?? (await ogImage(target)))
      : await ogImage(target);
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
      detail: tag(b, "description"),
      eventDates: tag(b, "calendarEvent:EventDates"),
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

async function fetchFeed(url: string, attempt = 0): Promise<RawItem[] | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, */*" } });
    if (!res.ok) {
      // Google/Bing throttle bursts with 429/503 — back off briefly and retry
      // instead of losing a whole feed (this used to silently drop the
      // glamour / picture searches on busy runs).
      if ((res.status === 429 || res.status >= 500) && attempt < 2) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        return fetchFeed(url, attempt + 1);
      }
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
    `"${city.en}" California city council OR schools OR police OR traffic`,
    `"${city.en}" California housing OR real estate OR rent OR development`,
    `"${city.en}" California business OR jobs OR layoffs OR tech`,
    `"${city.en}" California weather OR transit OR BART OR Caltrain OR road closure`,
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
      if (item.link && isGoogleNewsUrl(item.link)) {
        // Feed-level resolution can miss some wrappers; retry per item so the
        // stored link (and its artwork) points at the publisher.
        const real = await resolveGoogleNewsUrl(item.link);
        if (real && real !== item.link) item.link = real;
      }
      if (!item.image && item.link && !isGoogleNewsUrl(item.link)) {
        try {
          const host = new URL(item.link).hostname;
          item.image = /(?:^|\.)msn\.com$/.test(host)
            ? ((await msnImage(item.link)) ?? (await ogImage(item.link)))
            : await ogImage(item.link);
        } catch {
          /* unusable link */
        }
      }
      item.image = usableImage(item.image);

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
  // OTT / streaming attractions: what is landing this week on the platforms
  // Telugu-American households subscribe to.
  {
    kind: "news",
    queries: [
      "Telugu OTT release this week Aha OR Netflix OR Prime Video OR Hotstar",
      "Indian web series OTT premiere review streaming",
      "Netflix OR Prime Video OR JioHotstar India new series announcement",
      "Telugu movie OTT streaming date digital rights",
    ],
    match:
      /ott|streaming|web series|netflix|prime video|amazon prime|hotstar|jiohotstar|\baha\b|zee5|sony ?liv|apple tv|disney\+|episode|season|series/,
  },
  // Micro-dramas: vertical short-form serialised drama from India, China and
  // the US — its own desk, kept out of the Cinema feed.
  {
    kind: "news",
    queries: [
      "ReelShort app news series launch cast",
      "DramaBox app vertical drama news series",
      "FlickReels app short drama news",
      "micro drama vertical short drama app India news",
      "ReelShort OR DramaBox OR FlickReels OR Holywater micro drama news",
      "China micro drama duanju short drama industry news",
      "US vertical micro drama series app funding audience",
      "micro drama series launch cast photos India Telugu Hindi",
    ],
    match:
      /micro[- ]?drama|short[- ]?drama|vertical (?:drama|series|video)|reelshort|dramabox|flickreels|dramawave|goodshort|shortmax|holywater|flick ?tv|pocket ?fm|kuku ?fm|duanju|micro ?series/,
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
  // Home-state desks: Telangana / Hyderabad and Andhra Pradesh / Amaravati,
  // read straight from the state editions plus a property-market pass, since
  // most readers here have roots in the two Telugu states.
  { name: "The Hindu (Telangana)", url: "https://www.thehindu.com/news/national/telangana/feeder/default.rss", kind: "news", limit: 6 },
  { name: "The Hindu (Andhra Pradesh)", url: "https://www.thehindu.com/news/national/andhra-pradesh/feeder/default.rss", kind: "news", limit: 6 },
  { name: "The Times of India (Hyderabad)", url: "https://timesofindia.indiatimes.com/rssfeeds/-2128816011.cms", kind: "news", limit: 5 },
  {
    name: "Deccan Chronicle",
    url: "https://news.google.com/rss/search?q=site:deccanchronicle.com+(Telangana+OR+Hyderabad+OR+Andhra+OR+Amaravati)+when:3d&hl=en-IN&gl=IN&ceid=IN:en",
    kind: "news",
    limit: 6,
  },
  {
    name: "The New Indian Express",
    url: "https://news.google.com/rss/search?q=site:newindianexpress.com+(Telangana+OR+Hyderabad+OR+Andhra+OR+Amaravati+OR+Vijayawada+OR+Visakhapatnam)+when:3d&hl=en-IN&gl=IN&ceid=IN:en",
    kind: "news",
    limit: 6,
  },
  {
    name: "Telangana & Hyderabad",
    url: "https://news.google.com/rss/search?q=(Telangana+OR+Hyderabad+OR+Warangal+OR+%22Cyberabad%22)+(news+OR+government+OR+IT+OR+metro+OR+HYDRAA)+when:2d&hl=en-IN&gl=IN&ceid=IN:en",
    kind: "news",
    limit: 8,
  },
  {
    name: "Andhra Pradesh & Amaravati",
    url: "https://news.google.com/rss/search?q=(%22Andhra+Pradesh%22+OR+Amaravati+OR+Vijayawada+OR+Visakhapatnam+OR+Tirupati)+(capital+OR+government+OR+news+OR+projects+OR+investment)+when:2d&hl=en-IN&gl=IN&ceid=IN:en",
    kind: "news",
    limit: 8,
  },
  {
    name: "Amaravati capital works",
    url: "https://news.google.com/rss/search?q=Amaravati+(capital+OR+%22CRDA%22+OR+construction+OR+secretariat+OR+%22land+pooling%22+OR+plots)+when:7d&hl=en-IN&gl=IN&ceid=IN:en",
    kind: "news",
    limit: 6,
  },
  {
    name: "Telugu states property market",
    url: "https://news.google.com/rss/search?q=(Hyderabad+OR+Amaravati+OR+Vijayawada+OR+Visakhapatnam+OR+%22Andhra+Pradesh%22+OR+Telangana)+(%22real+estate%22+OR+%22property+prices%22+OR+%22land+rates%22+OR+apartments+OR+%22open+plots%22+OR+RERA+OR+%22housing+market%22)+when:7d&hl=en-IN&gl=IN&ceid=IN:en",
    kind: "news",
    limit: 8,
  },
  {
    name: "Telugu states (Telugu)",
    url: "https://news.google.com/rss/search?q=%E0%B0%A4%E0%B1%86%E0%B0%B2%E0%B0%82%E0%B0%97%E0%B0%BE%E0%B0%A3+OR+%E0%B0%B9%E0%B1%88%E0%B0%A6%E0%B0%B0%E0%B0%BE%E0%B0%AC%E0%B0%BE%E0%B0%A6%E0%B1%8D+OR+%E0%B0%86%E0%B0%82%E0%B0%A7%E0%B1%8D%E0%B0%B0%E0%B0%AA%E0%B1%8D%E0%B0%B0%E0%B0%A6%E0%B1%87%E0%B0%B6%E0%B1%8D+OR+%E0%B0%85%E0%B0%AE%E0%B0%B0%E0%B0%BE%E0%B0%B5%E0%B0%A4%E0%B0%BF+when:2d&hl=te&gl=IN&ceid=IN:te",
    kind: "news",
    limit: 6,
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
    name: "Tollywood heroines",
    url: "https://news.google.com/rss/search?q=(Tollywood+OR+%22Telugu+actress%22+OR+%22Telugu+heroine%22)+(photos+OR+stills+OR+glamour+OR+%22new+look%22+OR+%22photo+shoot%22)+when:7d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 8,
  },
  {
    name: "Tollywood glamour",
    url: "https://news.google.com/rss/search?q=(%22Tollywood+glamour%22+OR+%22Telugu+heroine+photos%22+OR+%22Tollywood+actress+photos%22+OR+%22Telugu+actress+gallery%22)+(stills+OR+photos+OR+gallery)+when:7d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 8,
  },
  {
    name: "Hollywood heroines",
    url: "https://news.google.com/rss/search?q=(Hollywood+actress+OR+%22Hollywood+heroine%22+OR+%22American+actress%22)+(photos+OR+stills+OR+gallery+OR+glamour+OR+%22red+carpet%22+OR+%22new+look%22)+when:7d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 8,
  },
  {
    name: "Hollywood stars",
    url: "https://news.google.com/rss/search?q=(Hollywood+celebrity+OR+%22movie+star%22+OR+%22Hollywood+actress%22)+(Instagram+OR+%22social+media%22+OR+photos+OR+stills+OR+glamour)+when:7d&hl=en-US&gl=US&ceid=US:en",
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
  // Glamour / social-media picture desks feeding the Gallery grid.
  { name: "M9 News", url: "https://www.m9.news/feed", kind: "news", limit: 6 },
  { name: "Mirchi9", url: "https://www.mirchi9.com/feed", kind: "news", limit: 5 },
  { name: "Telugu360", url: "https://www.telugu360.com/feed", kind: "news", limit: 5 },
  {
    name: "Glamour shoots",
    url: "https://news.google.com/rss/search?q=(%22glamorous+photos%22+OR+%22glamour+photoshoot%22+OR+%22hot+photos%22+OR+%22sizzling+photos%22+OR+%22stunning+stills%22+OR+%22bold+look%22)+(Telugu+OR+Tollywood+OR+Bollywood+OR+Hollywood+actress)+when:7d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 8,
  },
  {
    name: "Instagram buzz",
    url: "https://news.google.com/rss/search?q=(actress+OR+heroine)+(Instagram+OR+%22social+media%22+OR+%22Insta+post%22+OR+%22viral+photos%22+OR+%22breaks+the+internet%22)+(Telugu+OR+Tollywood+OR+Bollywood+OR+Hollywood)+when:7d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 8,
  },
  {
    name: "Red carpet & events",
    url: "https://news.google.com/rss/search?q=(actress+OR+heroine)+(%22red+carpet%22+OR+%22ramp+walk%22+OR+%22magazine+cover%22+OR+%22pre-release+event+photos%22+OR+%22award+function+photos%22)+(Telugu+OR+Bollywood+OR+Hollywood)+when:7d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 6,
  },
  {
    name: "OTT stars gallery",
    url: "https://news.google.com/rss/search?q=(%22web+series+actress%22+OR+%22OTT+actress%22+OR+%22Aha+heroine%22)+(photos+OR+stills+OR+gallery+OR+photoshoot)+when:7d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 5,
  },
  // South-Indian language star desks — Tamil, Malayalam, Kannada heroines.
  {
    name: "Kollywood heroines",
    url: "https://news.google.com/rss/search?q=(Kollywood+OR+%22Tamil+actress%22+OR+%22Tamil+heroine%22)+(photos+OR+stills+OR+gallery+OR+glamour+OR+%22photo+shoot%22+OR+%22new+look%22)+when:7d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 7,
  },
  {
    name: "Mollywood heroines",
    url: "https://news.google.com/rss/search?q=(Mollywood+OR+%22Malayalam+actress%22+OR+%22Malayalam+heroine%22)+(photos+OR+stills+OR+gallery+OR+glamour+OR+%22photo+shoot%22+OR+%22new+look%22)+when:7d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 7,
  },
  {
    name: "Sandalwood heroines",
    url: "https://news.google.com/rss/search?q=(Sandalwood+OR+%22Kannada+actress%22+OR+%22Kannada+heroine%22)+(photos+OR+stills+OR+gallery+OR+glamour+OR+%22photo+shoot%22+OR+%22new+look%22)+when:7d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 7,
  },
  {
    name: "South stars glamour",
    url: "https://news.google.com/rss/search?q=(%22South+Indian+actress%22+OR+%22South+actress%22)+(%22glamorous+photos%22+OR+photoshoot+OR+%22latest+stills%22+OR+%22viral+photos%22+OR+%22saree+look%22)+when:7d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 7,
  },
  {
    name: "గ్లామర్ ఫోటోలు",
    url: "https://news.google.com/rss/search?q=%E0%B0%97%E0%B1%8D%E0%B0%B2%E0%B0%BE%E0%B0%AE%E0%B0%B0%E0%B1%8D+%E0%B0%AB%E0%B1%8B%E0%B0%9F%E0%B1%8B%E0%B0%B2%E0%B1%81+OR+%E0%B0%85%E0%B0%82%E0%B0%A6%E0%B0%BE%E0%B0%B2+%E0%B0%A4%E0%B0%BE%E0%B0%B0+when:7d&hl=te&gl=IN&ceid=IN:te",
    kind: "news",
    limit: 6,
  },
  { name: "Pinkvilla", url: "https://www.pinkvilla.com/rss.xml", kind: "news", limit: 5 },
  // Micro-drama desk: Google News blocks these queries, so read them through the
  // Bing news RSS which answers reliably. Vertical short-drama coverage from
  // India, China and the US keeps the Micro-Drama section filled.
  {
    name: "Micro-drama wire",
    url: "https://www.bing.com/news/search?q=%22micro+drama%22+OR+%22short+drama%22+OR+%22vertical+drama%22&format=RSS&cc=us&setmkt=en-us&setlang=en-us",
    kind: "news",
    limit: 10,
  },
  {
    name: "ReelShort & DramaBox",
    url: "https://www.bing.com/news/search?q=ReelShort+OR+DramaBox+OR+FlickReels+OR+Holywater&format=RSS&cc=us&setmkt=en-us&setlang=en-us",
    kind: "news",
    limit: 10,
  },
  {
    name: "India short drama apps",
    url: "https://www.bing.com/news/search?q=India+%22micro+drama%22+OR+%22short+drama%22+app+OR+%22Flick+TV%22+OR+%22Chai+Shots%22+OR+%22Pocket+FM%22&format=RSS&cc=us&setmkt=en-us&setlang=en-us",
    kind: "news",
    limit: 8,
  },
  {
    name: "China duanju short drama",
    url: "https://www.bing.com/news/search?q=duanju+OR+%22Chinese+micro+drama%22+OR+%22short+drama+industry%22&format=RSS&cc=us&setmkt=en-us&setlang=en-us",
    kind: "news",
    limit: 8,
  },
  // Social-media picture desks: Instagram / X posts that publishers write up,
  // plus photo-story sections. These keep Glamourie topped up between runs.
  {
    name: "Instagram photo dumps",
    url: "https://news.google.com/rss/search?q=(actress+OR+heroine+OR+%22model%22)+(%22photo+dump%22+OR+%22Instagram+post%22+OR+%22Instagram+story%22+OR+%22shares+photos%22+OR+%22drops+photos%22+OR+%22drops+pictures%22+OR+%22latest+Instagram%22)+when:3d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 10,
  },
  {
    name: "Social media buzz",
    url: "https://news.google.com/rss/search?q=(actress+OR+heroine)+(%22goes+viral%22+OR+%22breaks+the+internet%22+OR+%22sets+the+internet%22+OR+%22trending+on+Instagram%22+OR+%22fans+react%22)+(photos+OR+pics+OR+reel)+when:3d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 10,
  },
  {
    name: "Star photo stories",
    url: "https://news.google.com/rss/search?q=(%22photo+gallery%22+OR+photostory+OR+%22in+pics%22+OR+%22in+pictures%22+OR+%22web+stories%22)+(actress+OR+heroine+OR+Tollywood+OR+Bollywood+OR+Kollywood)+when:3d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 10,
  },
  {
    name: "Heroine photoshoot wire",
    url: "https://news.google.com/rss/search?q=(actress+OR+heroine)+(photoshoot+OR+%22photo+shoot%22+OR+%22new+stills%22+OR+%22latest+stills%22+OR+%22glam+photos%22+OR+%22photo+gallery%22)+when:5d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 14,
  },
  {
    name: "South heroine pics daily",
    url: "https://news.google.com/rss/search?q=(Telugu+OR+Tamil+OR+Malayalam+OR+Kannada)+(actress+OR+heroine)+(photos+OR+pics+OR+stills+OR+gallery)+when:3d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 14,
  },
  {
    name: "Bollywood heroine pics daily",
    url: "https://news.google.com/rss/search?q=(Bollywood+OR+Hindi)+actress+(photos+OR+pics+OR+%22spotted%22+OR+%22red+carpet%22+OR+%22looks%22)+when:3d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 12,
  },
  {
    name: "Saree & ethnic looks",
    url: "https://news.google.com/rss/search?q=(actress+OR+heroine)+(%22saree+look%22+OR+%22ethnic+look%22+OR+%22traditional+look%22+OR+%22lehenga%22+OR+%22gown%22+OR+%22airport+look%22)+(photos+OR+pics+OR+stills)+when:7d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 8,
  },
  {
    name: "TOI entertainment photos",
    url: "https://timesofindia.indiatimes.com/rssfeeds/1081479906.cms",
    kind: "news",
    limit: 8,
  },
  {
    name: "Telugu heroine photos (Telugu)",
    url: "https://news.google.com/rss/search?q=%E0%B0%B9%E0%B1%80%E0%B0%B0%E0%B1%8B%E0%B0%AF%E0%B0%BF%E0%B0%A8%E0%B1%8D+%E0%B0%AB%E0%B1%8B%E0%B0%9F%E0%B1%8B%E0%B0%B2%E0%B1%81+OR+%E0%B0%A8%E0%B0%9F%E0%B0%BF+%E0%B0%AB%E0%B1%8B%E0%B0%9F%E0%B1%8B%E0%B0%B2%E0%B1%81+OR+%E0%B0%85%E0%B0%82%E0%B0%A6%E0%B0%BE%E0%B0%B2+%E0%B0%AC%E0%B1%8D%E0%B0%AF%E0%B1%82%E0%B0%9F%E0%B1%80+when:7d&hl=te&gl=IN&ceid=IN:te",
    kind: "news",
    limit: 8,
  },

  {
    name: "Heroine photo galleries (wide)",
    url: "https://news.google.com/rss/search?q=(actress+OR+heroine)+(photos+OR+pics+OR+gallery+OR+photoshoot)+when:3d&hl=en-IN&gl=IN&ceid=IN:en",
    kind: "news",
    limit: 12,
  },
  {
    name: "Ragalahari galleries",
    url: "https://news.google.com/rss/search?q=site:ragalahari.com+when:7d&hl=en-IN&gl=IN&ceid=IN:en",
    kind: "news",
    limit: 12,
  },
  {
    name: "TeluguStop photos",
    url: "https://news.google.com/rss/search?q=site:telugustop.com+(photos+OR+gallery+OR+stills)+when:7d&hl=en-IN&gl=IN&ceid=IN:en",
    kind: "news",
    limit: 10,
  },
  {
    name: "Pinkvilla photos",
    url: "https://news.google.com/rss/search?q=site:pinkvilla.com+(photos+OR+pics+OR+look)+when:3d&hl=en-IN&gl=IN&ceid=IN:en",
    kind: "news",
    limit: 10,
  },
  {
    name: "Heroine latest looks",
    url: "https://news.google.com/rss/search?q=(actress+OR+heroine)+(stuns+OR+latest+look+OR+saree+OR+traditional+look+OR+viral+photos)+when:3d&hl=en-IN&gl=IN&ceid=IN:en",
    kind: "news",
    limit: 12,
  },
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

  // Direct picture-desk feeds. The Google News search feeds above answer 503 on
  // many gallery queries, which starved Glamourie, so the pool now leans on
  // publisher RSS that always answers. Every row still passes the photo /
  // female-star / portrait-quality gates before it reaches the desk.
  { name: "NDTV Movies photos", url: "https://feeds.feedburner.com/ndtvmovies-latest", kind: "news", limit: 40 },
  { name: "Koimoi", url: "https://www.koimoi.com/feed/", kind: "news", limit: 20 },
  { name: "India Today Movies", url: "https://www.indiatoday.in/rss/1206614", kind: "news", limit: 20 },
  { name: "eTimes photos", url: "https://timesofindia.indiatimes.com/rssfeeds/-2128672765.cms", kind: "news", limit: 20 },
  { name: "eTimes Telugu", url: "https://timesofindia.indiatimes.com/rssfeeds/2886704.cms", kind: "news", limit: 20 },
  { name: "The Hindu Movies", url: "https://www.thehindu.com/entertainment/movies/feeder/default.rss", kind: "news", limit: 30 },
  { name: "Free Press Entertainment", url: "https://www.freepressjournal.in/stories.rss?section=entertainment", kind: "news", limit: 20 },
  { name: "Deccan Chronicle Entertainment", url: "https://www.deccanchronicle.com/google_feeds.xml", kind: "news", limit: 30 },


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

/**
 * City activity guides and municipal calendars (Redwood City's activity guide,
 * Milpitas / Dublin recreation calendars, and the equivalent page on each other
 * city site). Cities run these on CivicPlus / Granicus, so we read the calendar
 * and news RSS where it exists and fall back to a news search for the city's
 * "activity guide" so classes, camps and park programmes for the month still
 * reach the desk. Items that read like a programme file as events; the rest as
 * city news.
 */
const CITY_GUIDE_FEEDS: { citySlug: string; label: string; urls: string[] }[] = [
  {
    citySlug: "milpitas",
    label: "City of Milpitas",
    urls: [
      "https://www.milpitas.gov/RSSFeed.aspx?ModID=76&CID=All-0",
      "https://www.milpitas.gov/RSSFeed.aspx?ModID=58&CID=All-0",
    ],
  },
  {
    citySlug: "dublin",
    label: "City of Dublin",
    urls: [
      "https://www.dublin.ca.gov/RSSFeed.aspx?ModID=76&CID=All-0",
      "https://www.dublin.ca.gov/RSSFeed.aspx?ModID=58&CID=All-0",
    ],
  },
  {
    citySlug: "union-city",
    label: "City of Union City",
    urls: [
      "https://www.unioncity.org/RSSFeed.aspx?ModID=76&CID=All-0",
      "https://www.unioncity.org/RSSFeed.aspx?ModID=58&CID=All-0",
    ],
  },
  {
    // Morgan Hill and Redwood City are not tracked slugs, so their guides file
    // under the region-wide bucket and show up in City News / Events.
    citySlug: BAY_AREA.slug,
    label: "City of Morgan Hill",
    urls: [
      "https://www.morganhill.ca.gov/RSSFeed.aspx?ModID=76&CID=All-0",
      "https://www.morganhill.ca.gov/RSSFeed.aspx?ModID=58&CID=All-0",
    ],
  },
  {
    citySlug: BAY_AREA.slug,
    label: "City of Redwood City",
    urls: [
      "https://www.redwoodcity.org/RSSFeed.aspx?ModID=76&CID=All-0",
      "https://www.redwoodcity.org/RSSFeed.aspx?ModID=58&CID=All-0",
    ],
  },
  {
    citySlug: BAY_AREA.slug,
    label: "City of San Leandro",
    urls: ["https://www.sanleandro.org/RSSFeed.aspx?ModID=76&CID=All-0"],
  },
  {
    citySlug: "fremont",
    label: "City of Fremont",
    urls: ["https://www.fremont.gov/RSSFeed.aspx?ModID=58&CID=All-0"],
  },
  {
    citySlug: "santa-clara",
    label: "City of Santa Clara",
    urls: ["https://www.santaclaraca.gov/RSSFeed.aspx?ModID=58&CID=All-0"],
  },
  {
    citySlug: "sunnyvale",
    label: "City of Sunnyvale",
    urls: ["https://www.sunnyvale.ca.gov/RSSFeed.aspx?ModID=58&CID=All-0"],
  },
  {
    citySlug: "cupertino",
    label: "City of Cupertino",
    urls: ["https://www.cupertino.gov/RSSFeed.aspx?ModID=58&CID=All-0"],
  },
  {
    citySlug: "palo-alto",
    label: "City of Palo Alto",
    urls: ["https://www.cityofpaloalto.org/RSSFeed.aspx?ModID=58&CID=All-0"],
  },
  {
    citySlug: "mountain-view",
    label: "City of Mountain View",
    urls: ["https://www.mountainview.gov/RSSFeed.aspx?ModID=58&CID=All-0"],
  },
];

/** Cities whose guides we only reach through a news search. */
const GUIDE_SEARCH_CITIES = [
  ...CITIES.map((c) => ({ citySlug: c.slug, name: c.en })),
  { citySlug: BAY_AREA.slug, name: "Redwood City" },
];

const GUIDE_WORDS =
  /activity guide|recreation|rec guide|parks and rec|class(?:es)?|camp|program|programme|registration|enroll|swim|library|storytime|summer|fall|winter|spring|senior center|community center|workshop|clinic|league/i;

/** Keep items dated inside this month or the following six weeks. */
/**
 * Municipal calendars stamp <pubDate> with the day staff posted the listing,
 * not the day the activity runs — a class posted in July but running next month
 * used to be dropped. Prefer the event date carried in the calendar element or
 * the "Event date: ..." line of the description.
 */
function guideDate(item: RawItem): string | null {
  const raw =
    item.eventDates?.trim() ||
    item.detail?.match(/event date:?\s*([A-Za-z]+\s+\d{1,2},\s*\d{4})/i)?.[1] ||
    "";
  if (raw) {
    const t = Date.parse(raw);
    if (!Number.isNaN(t)) return new Date(t).toISOString();
  }
  return item.published;
}

/** Keep activities happening now or soon (and news posted in the last month). */
function inGuideWindow(published: string | null): boolean {
  if (!published) return true;
  const t = Date.parse(published);
  if (Number.isNaN(t)) return true;
  const behind = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const ahead = Date.now() + 75 * 24 * 60 * 60 * 1000;
  return t >= behind && t <= ahead;
}

const GUIDE_MAX = 10;

/** City-site boilerplate that is not an activity or a story. */
const GUIDE_JUNK =
  /public notice|agenda|minutes|commission|council meeting|subcommittee|zoning administrator|planning commission|board of|election|bid|rfp|request for proposal|job|employment|vacan|budget hearing|surplus|ordinance|volunteer opportunit|staff report|permit|utility bill|closed session|cancelled|canceled/i;

async function fetchCityGuide(entry: {
  citySlug: string;
  label: string;
  urls: string[];
}): Promise<RawItem[]> {
  const results = await Promise.all(
    entry.urls.map(async (url) => {
      const parsed = await fetchFeed(url);
      if (!parsed?.length) return [];
      lastDiag.fetched += 1;
      lastDiag.raw += parsed.length;
      // ModID=58 is the municipal calendar (activities); 76 is the newsroom.
      const calendar = /ModID=58/i.test(url);
      return parsed.map((i) => ({ ...i, source: entry.label, calendar }));
    }),
  );
  const seen = new Set<string>();
  const merged: RawItem[] = [];
  for (const item of results.flat()) {
    const k = normalize(item.title);
    if (!k || seen.has(k)) continue;
    const when = guideDate(item);
    if (!inGuideWindow(when)) continue;
    // City feeds mix programme listings with procedural notices; keep the
    // activities and drop the administrivia. Anything else on a city calendar
    // or newsroom is genuine local activity, so no keyword gate here.
    if (GUIDE_JUNK.test(item.title)) continue;
    seen.add(k);
    // Bare page titles ("Lap Swim Schedule") need the city for context.
    merged.push({ ...item, title: `${item.title} — ${entry.label}`, published: when });
    if (merged.length >= GUIDE_MAX) break;
  }
  await addImages(merged);
  lastDiag.kept += merged.length;

  return merged;
}

async function fetchGuideSearch(city: { citySlug: string; name: string }): Promise<RawItem[]> {
  const q = `"${city.name}" California ("activity guide" OR "parks and recreation" OR "community center") classes OR camps OR events OR registration`;
  let parsed = await fetchFeed(
    `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=RSS&cc=us&setmkt=en-us&setlang=en-us`,
  );
  if (!parsed?.length) {
    parsed = await fetchFeed(
      `https://news.google.com/rss/search?q=${encodeURIComponent(q)}+when:14d&hl=en-US&gl=US&ceid=US:en`,
    );
  }
  if (!parsed?.length) return [];
  lastDiag.fetched += 1;
  lastDiag.raw += parsed.length;
  const cityWords = normalize(city.name);
  const seen = new Set<string>();
  const merged: RawItem[] = [];
  for (const item of parsed) {
    const hay = normalize(`${item.title} ${item.source}`);
    const k = normalize(item.title);
    if (!k || seen.has(k)) continue;
    if (!hay.includes(cityWords) || !GUIDE_WORDS.test(hay)) continue;
    if (!inGuideWindow(item.published)) continue;
    seen.add(k);
    merged.push(item);
    if (merged.length >= 4) break;
  }
  await addImages(merged);
  lastDiag.kept += merged.length;
  return merged;
}

/** Programme-style listings belong in Events; announcements read as news. */
function guideKind(item: RawItem): CollectedItem["kind"] {
  if (TEMPLE_WORDS.test(item.title)) return "temple";
  // Everything on a city calendar is a dated activity.
  if (item.calendar) return "event";
  if (EVENT_WORDS.test(item.title) || GUIDE_WORDS.test(item.title)) return "event";
  return "news";
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
    // Hard ceiling: a slow gateway must never shrink or stall the collected
    // pool. If the note is late we ship the fallback line instead.
    const { text } = await Promise.race([
      generateText({
        model: gateway("google/gemini-3.1-flash-lite"),
        prompt:
          `You write short editorial notes for a Telugu-American community news desk in ${city.en}, California.\n` +
          `For each numbered headline below, write ONE neutral sentence (max 28 words) explaining what it means for local residents. Do not invent facts beyond the headline.\n` +
          `Reply with exactly ${items.length} lines, each formatted as "<number>. <sentence>". No other text.\n\n` +
          items.map((it, i) => `${i + 1}. ${it.title} (${it.source})`).join("\n"),
      }),
      new Promise<{ text: string }>((resolve) =>
        setTimeout(() => resolve({ text: "" }), 9000),
      ),
    ]);

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

  // City activity guides and municipal recreation calendars for the month.
  const guideEntries = [
    ...CITY_GUIDE_FEEDS.map((e) => ({ kind: "feed" as const, entry: e })),
    ...GUIDE_SEARCH_CITIES.map((c) => ({ kind: "search" as const, entry: c })),
  ];
  for (let b = 0; b < guideEntries.length; b += 5) {
    const guideRows = await Promise.all(
      guideEntries.slice(b, b + 5).map(async (g) => {
        const items =
          g.kind === "feed" ? await fetchCityGuide(g.entry) : await fetchGuideSearch(g.entry);
        const slug = g.entry.citySlug;
        const city = cityBySlug(slug) ?? BAY_AREA;
        const summaries = await summarize(city, items, apiKey);
        return items.map((it, i) => {
          const kind = guideKind(it);
          const dedupe = keyFor(slug, it.title);
          return {
            dedupe_key: dedupe,
            item_id: dedupe,
            digest_date: (it.published ?? `${today}T00:00:00Z`).slice(0, 10),
            kind,
            city_slug: slug,
            title: it.title,
            summary: summaries[i] ?? "",
            source: it.source,
            source_url: it.link,
            published_at: it.published,
            origin: "feed" as const,
            payload: {
              id: dedupe,
              kind,
              citySlug: slug,
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
    rows.push(...guideRows.flat());
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
  const publisherBatches: CollectedItem[][] = [];
  for (let b = 0; b < PUBLISHER_FEEDS.length; b += 8) {
  const publisherRows = await Promise.all(
    PUBLISHER_FEEDS.slice(b, b + 8).map(async (feed) => {
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
    publisherBatches.push(publisherRows.flat());
  }
  rows.push(...publisherBatches.flat());


  // First-party newsroom: our own WordPress site (bayarea.telugutimes.net).
  try {
    const { fetchWordPressPosts, WP_SOURCE_NAME } = await import("./wp-source.server");
    const posts = await fetchWordPressPosts(300);
    lastDiag.notes.push(`wordpress: ${posts.length} posts`);
    for (const p of posts) {
      const kind =
        p.categorySlug === "events"
          ? ("event" as const)
          : p.categorySlug === "temples"
            ? ("temple" as const)
            : classify(p.title);
      const dedupe = keyFor(BAY_AREA.slug, p.title);
      rows.push({
        dedupe_key: dedupe,
        item_id: dedupe,
        digest_date: (p.published ?? `${today}T00:00:00Z`).slice(0, 10),
        kind,
        city_slug: BAY_AREA.slug,
        title: p.title,
        summary: p.summary,
        source: WP_SOURCE_NAME,
        source_url: p.link,
        published_at: p.published,
        origin: "feed" as const,
        payload: {
          id: dedupe,
          kind,
          citySlug: BAY_AREA.slug,
          title: p.title,
          summary: p.summary,
          source: WP_SOURCE_NAME,
          sourceUrl: p.link,
          image: p.image,
          category: p.categorySlug,
          collectedAt: today,
        },
      } satisfies CollectedItem);
    }
  } catch (e) {
    lastDiag.notes.push(`wordpress pull failed: ${e instanceof Error ? e.message : String(e)}`);
  }

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

/** Picture desks that feed the Gallery grid. */
const GALLERY_FEED_NAMES = [
  "123Telugu Gallery",
  "Heroine galleries",
  "Tollywood heroines",
  "Tollywood glamour",
  "Hollywood heroines",
  "Hollywood stars",
  "Bollywood stars",
  "OTT stars gallery",
  "Glamour shoots",
  "Instagram buzz",
  "Red carpet & events",
  "గ్లామర్ ఫోటోలు",
  "Pinkvilla",
  "Bollywood Hungama",
  "M9 News",
  "Mirchi9",
  "Kollywood heroines",
  "Mollywood heroines",
  "Sandalwood heroines",
  "South stars glamour",
  "Instagram photo dumps",
  "Social media buzz",
  "Star photo stories",
  "Saree & ethnic looks",
  "Heroine photoshoot wire",
  "South heroine pics daily",
  "Bollywood heroine pics daily",
  "TOI entertainment photos",
  "Telugu heroine photos (Telugu)",
  "Telugu360",
  "Heroine photo galleries (wide)",
  "Ragalahari galleries",
  "TeluguStop photos",
  "Pinkvilla photos",
  "Heroine latest looks",
  "తెలుగు హీరోయిన్లు",
  "NDTV Movies photos",
  "Koimoi",
  "India Today Movies",
  "eTimes photos",
  "eTimes Telugu",
  "The Hindu Movies",
  "Free Press Entertainment",
  "Deccan Chronicle Entertainment",
  "123Telugu",
  "Bollywood Hungama",
  "Pinkvilla",

];

/**
 * Gallery-only pass: re-reads the star / photo desks with a wider limit so the
 * Cinema Gallery keeps filling up between the full collection runs.
 */
export async function collectGallery(apiKey: string | undefined): Promise<CollectedItem[]> {
  const today = new Date().toISOString().slice(0, 10);
  const feeds = PUBLISHER_FEEDS.filter((f) => GALLERY_FEED_NAMES.includes(f.name)).map((f) => ({
    ...f,
    limit: Math.max(f.limit ?? 6, 60),
  }));
  const rows: CollectedItem[] = [];
  for (let b = 0; b < feeds.length; b += 6) {
    const batches = await Promise.all(
      feeds.slice(b, b + 6).map(async (feed) => {
        const items = await fetchPublisher(feed);
        const summaries = await summarize(BAY_AREA, items, apiKey);
        return items.map((it, i) => {
          const dedupe = keyFor(BAY_AREA.slug, it.title);
          const kind = classify(it.title);
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
    rows.push(...batches.flat());
  }
  // Only picture-led star stories belong in this pass.
  const { isStarGallery } = await import("./cinema-topics");
  const { galleryImage } = await import("./story-image");
  return dedupeCollected(
    rows.filter(
      (r) =>
        // Quality check: the attached picture must read as people photography,
        // not stock nature / graphic filler.
        !!galleryImage((r.payload as { image?: string | null } | undefined)?.image ?? null) &&
        isStarGallery(r.title, r.summary, r.source_url ?? ""),
    ),
  );
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
