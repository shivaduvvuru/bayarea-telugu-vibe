import { CITIES, type City } from "./desk-cities";
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
  return url;
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

/** Reads the article page and returns its og:image / twitter:image, if any. */
async function ogImage(link: string): Promise<string | null> {
  try {
    const res = await fetch(link, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 200_000);
    const m =
      html.match(/<meta[^>]+property="og:image(?::secure_url)?"[^>]+content="([^"]+)"/i) ??
      html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i) ??
      html.match(/<meta[^>]+name="twitter:image(?::src)?"[^>]+content="([^"]+)"/i) ??
      html.match(/<link[^>]+rel="image_src"[^>]+href="([^"]+)"/i) ??
      html.match(/<img[^>]+src="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i);
    const raw = m?.[1]?.trim();
    if (!raw) return null;
    const abs = raw.startsWith("//") ? `https:${raw}` : new URL(raw, res.url || link).toString();
    return cleanUrl(abs);
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
    const title = rawTitle.replace(new RegExp(`\\s-\\s${source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), "");
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
export const lastDiag = { fetched: 0, raw: 0, kept: 0, notes: [] as string[] };

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function fetchFeed(url: string): Promise<RawItem[] | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, */*" } });
    if (!res.ok) {
      if (lastDiag.notes.length < 6) lastDiag.notes.push(`HTTP ${res.status} ${new URL(url).host}`);
      return null;
    }
    return parseRss(await res.text());
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
  // Feeds rarely carry artwork, so read og:image from the article page itself.
  await Promise.all(
    merged.map(async (item) => {
      // Aggregator stub links can't be scraped; only try real publisher URLs.
      if (item.image || !item.link || /news\.google\.com/.test(item.link)) return;
      item.image = /(?:^|\.)msn\.com$/.test(new URL(item.link).hostname)
        ? await msnImage(item.link)
        : await ogImage(item.link);
    }),
  );

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

  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.dedupe_key) ? false : (seen.add(r.dedupe_key), true)));
}
