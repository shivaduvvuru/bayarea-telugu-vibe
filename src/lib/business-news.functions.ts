import { createServerFn } from "@tanstack/react-start";

export type BizItem = {
  id: string;
  title: string;
  summary: string;
  url: string;
  image: string | null;
  publishedAt: string | null;
  desk: "business" | "tech" | "politics";
  /** Publisher named by the aggregator, when it credits one. */
  publisher: string | null;
};

export type BizStat = {
  title: string;
  summary: string;
  url: string;
  image: string | null;
  publishedAt: string | null;
};

export type BusinessBrief = {
  items: BizItem[];
  /** Quote / statistic of the day, from Statista's chart of the day when reachable. */
  stat: BizStat | null;
  fetchedAt: string;
};

const FEEDS: ReadonlyArray<{ url: string; desk: BizItem["desk"] }> = [
  { url: "https://biztoc.com/feed", desk: "business" },
  { url: "https://biztoc.com/feed/tech", desk: "tech" },
  { url: "https://biztoc.com/feed/politics", desk: "politics" },
];

const STATISTA_FEED = "https://www.statista.com/chartoftheday/feed/";

const UA =
  "Mozilla/5.0 (compatible; TimesBayAreaBot/1.0; +https://www.timesbayarea.com)";

function decode(raw: string) {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#x27;/gi, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1]! : "";
}

function firstImage(block: string) {
  const src = block.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
  if (src) return src;
  const enclosure = block.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*>/i)?.[1];
  return enclosure ?? null;
}

async function readFeed(url: string, signal: AbortSignal) {
  const res = await fetch(url, {
    signal,
    headers: { "user-agent": UA, accept: "application/rss+xml, application/xml, text/xml" },
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  const xml = await res.text();
  return xml.split(/<item[\s>]/i).slice(1).map((chunk) => `<item ${chunk}`);
}

function parseItem(block: string, desk: BizItem["desk"]): BizItem | null {
  const title = decode(tag(block, "title"));
  const url = decode(tag(block, "link"));
  if (!title || !/^https?:\/\//.test(url)) return null;
  const body = tag(block, "description") || tag(block, "content:encoded");
  const summary = decode(body).slice(0, 320);
  const dateRaw = decode(tag(block, "pubDate"));
  const parsed = dateRaw ? new Date(dateRaw) : null;
  // BizToc appends the originating publisher in parentheses on many items.
  const publisher = title.match(/\(([^()]{2,40})\)\s*$/)?.[1] ?? null;
  return {
    id: url,
    title,
    summary,
    url,
    image: firstImage(body),
    publishedAt: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null,
    desk,
    publisher,
  };
}

/**
 * Business / tech / political headlines aggregated by BizToc, plus a Statista
 * chart-of-the-day statistic. Both sources are credited and linked out.
 */
export const getBusinessBrief = createServerFn({ method: "GET" }).handler(
  async (): Promise<BusinessBrief> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const [feeds, statista] = await Promise.all([
        Promise.all(
          FEEDS.map(async ({ url, desk }) => {
            try {
              const blocks = await readFeed(url, controller.signal);
              return blocks
                .slice(0, 14)
                .map((b) => parseItem(b, desk))
                .filter((i): i is BizItem => Boolean(i));
            } catch (err) {
              console.error("business brief feed failed", url, (err as Error).message);
              return [] as BizItem[];
            }
          }),
        ),
        (async (): Promise<BizStat | null> => {
          try {
            const blocks = await readFeed(STATISTA_FEED, controller.signal);
            const first = blocks[0];
            if (!first) return null;
            const parsed = parseItem(first, "business");
            if (!parsed) return null;
            return {
              title: parsed.title,
              summary: parsed.summary,
              url: parsed.url,
              image: parsed.image,
              publishedAt: parsed.publishedAt,
            };
          } catch (err) {
            console.error("statista chart of the day failed", (err as Error).message);
            return null;
          }
        })(),
      ]);

      // Interleave desks so business does not swamp tech and politics.
      const lanes = feeds.map((l) => [...l]);
      const items: BizItem[] = [];
      const seen = new Set<string>();
      while (items.length < 30 && lanes.some((l) => l.length)) {
        for (const lane of lanes) {
          const next = lane.shift();
          if (!next) continue;
          const key = next.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
          if (seen.has(key) || seen.has(next.url)) continue;
          seen.add(key);
          seen.add(next.url);
          items.push(next);
        }
      }

      return { items, stat: statista, fetchedAt: new Date().toISOString() };
    } finally {
      clearTimeout(timer);
    }
  },
);
