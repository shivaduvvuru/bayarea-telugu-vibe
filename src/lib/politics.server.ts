/**
 * Server-only political news puller. Reads the Google News RSS feed behind
 * every source in politics-sources.ts and normalises the results.
 */
import { POLITICS_SOURCES, type PoliticsSource } from "./politics-sources";
import { dedupeBy } from "./dedupe";

export type PoliticsStory = {
  sourceId: string;
  place: string;
  region: string;
  scope: "local" | "india";
  title: string;
  publisher: string;
  url: string;
  date: string | null;
};

export type PoliticsFeedResult = {
  source: PoliticsSource;
  stories: PoliticsStory[];
  ok: boolean;
};

const TIMEOUT_MS = 8000;
const PER_SOURCE = 8;
const MAX_AGE_DAYS = 45;

function decode(s: string) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;|&rsquo;/g, "\u2019")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&#8211;|&ndash;/g, "\u2013")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Google News titles end with " - Publisher"; split that off. */
function splitPublisher(title: string) {
  const at = title.lastIndexOf(" - ");
  if (at < 20) return { title, publisher: "" };
  return { title: title.slice(0, at).trim(), publisher: title.slice(at + 3).trim() };
}

function parseRss(xml: string) {
  const out: { title: string; url: string; date: string | null }[] = [];
  for (const block of xml.split(/<item[\s>]/i).slice(1)) {
    const title = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const link = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
    const date = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
    if (!title) continue;
    const parsed = date ? new Date(date[1]!.trim()) : null;
    out.push({
      title: decode(title[1] ?? ""),
      url: (link?.[1] ?? "").trim(),
      date: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null,
    });
  }
  return out;
}

function fresh(iso: string | null) {
  if (!iso) return true;
  const age = Date.now() - new Date(iso).getTime();
  return age < MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

async function fetchSource(source: PoliticsSource): Promise<PoliticsFeedResult> {
  try {
    const res = await fetch(source.url, {
      headers: {
        "User-Agent": "BayAreaTeluguTimes/1.0 (+https://bayarea.telugutimes.net)",
        Accept: "application/rss+xml,application/xml",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { source, stories: [], ok: false };
    const items = parseRss(await res.text());

    const mapped: PoliticsStory[] = [];
    for (const item of items) {
      if (item.title.length < 15 || !/^https?:\/\//i.test(item.url)) continue;
      if (!fresh(item.date)) continue;
      const { title, publisher } = splitPublisher(item.title);
      mapped.push({
        sourceId: source.id,
        place: source.name,
        region: source.region,
        scope: source.scope,
        title,
        publisher,
        url: item.url,
        date: item.date,
      });
    }
    // The same wire story is syndicated by several outlets — keep one.
    const { unique } = dedupeBy(mapped, (s) => s.title);
    return { source, stories: unique.slice(0, PER_SOURCE), ok: true };
  } catch (err) {
    console.error(`politics feed failed for ${source.id}`, err);
    return { source, stories: [], ok: false };
  }
}

/** Fetch every source in parallel; a slow feed never blocks the others. */
export async function fetchAllPolitics(): Promise<PoliticsFeedResult[]> {
  return Promise.all(POLITICS_SOURCES.map(fetchSource));
}