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

type RawItem = { title: string; link: string; source: string; published: string | null };

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
      link: tag(b, "link"),
      source,
      published: pub ? new Date(pub).toISOString() : null,
    });
  }
  return out;
}

/** Diagnostics for the last collect run, surfaced by the collect endpoint. */
export const lastDiag = { fetched: 0, raw: 0, kept: 0, notes: [] as string[] };

async function fetchCity(city: City): Promise<RawItem[]> {
  const queries = [
    `"${city.en}" California city news`,
    `"${city.en}" California Indian OR Telugu OR temple OR community event`,
  ];
  const results = await Promise.all(
    queries.map(async (q) => {
      try {
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}+when:2d&hl=en-US&gl=US&ceid=US:en`;
        const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; BayAreaDigest/1.0)" } });
        if (!res.ok) {
          if (lastDiag.notes.length < 5) lastDiag.notes.push(`${city.slug}: HTTP ${res.status}`);
          return [];
        }
        const parsed = parseRss(await res.text());
        lastDiag.fetched += 1;
        lastDiag.raw += parsed.length;
        return parsed;
      } catch (e) {
        if (lastDiag.notes.length < 5)
          lastDiag.notes.push(`${city.slug}: ${e instanceof Error ? e.message : String(e)}`);
        return [];
      }
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
