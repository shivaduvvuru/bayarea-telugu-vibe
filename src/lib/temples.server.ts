/**
 * Server-only scraper that reads announcements straight from each Bay Area
 * temple's own website.
 */
import { TEMPLE_SOURCES, type TempleSource } from "./temple-sources";

export type TempleAnnouncement = {
  templeId: string;
  temple: string;
  city: string;
  region: string;
  title: string;
  url: string;
  date: string | null;
};

export type TempleFeedResult = {
  source: TempleSource;
  announcements: TempleAnnouncement[];
  ok: boolean;
};

const TIMEOUT_MS = 8000;

/** Words that make a heading look like a temple event rather than site chrome. */
const EVENT_WORDS =
  /(puja|pooja|abhishek|homam|havan|festival|jayanthi|jayanti|vratam|vratham|utsav|celebrat|aarti|arati|bhajan|kalyanam|navratri|janmashtami|ganesh|krishna|shiva|lakshmi|hanuman|murugan|karthikeya|ayyappa|venkateswara|balaji|durga|saraswati|sharada|upakarma|archana|annadan|satsang|yagna|yagya|parayan|parayana|chaturthi|ekadasi|purnima|poornima|amavasya|deepavali|diwali|ugadi|sankranti|sankatahara|ramayan|rudram|chandi|sahasranama|kumbabhishekam|panchami|shashti|pradosham|katha|discourse)/i;

/** Generic titles that are navigation, not announcements. */
const NOISE =
  /^(home|about|about us|contact|contact us|donate|donations?|temple|temple hours|temple timings|arati timings|our temple|events?|temple events?|upcoming events?|featured temple events?|gallery|photos|newsletter|volunteer|sponsors?|services?|temple seva|join .*|stay connected|subscribe|search|menu|schedule|pooja schedule|priest services)$/i;

function decode(s: string) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;|&rsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&#8211;|&ndash;/g, "-")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(s: string) {
  return decode(s.replace(/<[^>]+>/g, " "));
}

/** Pull a US-style or ISO date out of nearby text, if one is present. */
function findDate(text: string): string | null {
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];
  const us = text.match(
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,\s*20\d{2})?\b/i,
  );
  return us ? us[0] : null;
}

function parseRss(xml: string) {
  const out: { title: string; url: string; date: string | null }[] = [];
  for (const block of xml.split(/<item[\s>]/i).slice(1)) {
    const title = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const link = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
    const date = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
    if (!title) continue;
    out.push({
      title: stripTags(title[1] ?? ""),
      url: (link?.[1] ?? "").trim(),
      date: date ? new Date(date[1]!.trim()).toISOString().slice(0, 10) : null,
    });
  }
  return out;
}

function parseHtml(html: string, pageUrl: string) {
  const out: { title: string; url: string; date: string | null }[] = [];
  const headings = [...html.matchAll(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi)];
  for (const m of headings) {
    const title = stripTags(m[1] ?? "");
    if (!title) continue;
    // Look at the ~400 chars after the heading for a date.
    const idx = (m.index ?? 0) + m[0].length;
    const near = stripTags(html.slice(idx, idx + 400));
    out.push({ title, url: pageUrl, date: findDate(`${title} ${near}`) });
  }
  return out;
}

function usable(title: string, source: TempleSource) {
  if (title.length < 8 || title.length > 140) return false;
  if (NOISE.test(title)) return false;
  // The temple's own name is a banner, not an announcement.
  if (title.toLowerCase().includes(source.name.toLowerCase().slice(0, 12))) return false;
  // Drop items that clearly belong to a past year.
  const year = title.match(/\b(20\d{2})\b/);
  if (year && Number(year[1]) < new Date().getFullYear()) return false;
  return EVENT_WORDS.test(title);
}

async function fetchSource(source: TempleSource): Promise<TempleFeedResult> {
  for (const feed of source.feeds) {
    try {
      const res = await fetch(feed.url, {
        headers: {
          "User-Agent": "BayAreaTeluguTimes/1.0 (+https://bayarea.telugutimes.net)",
          Accept: feed.mode === "rss" ? "application/rss+xml,application/xml" : "text/html",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const body = await res.text();
      const raw = feed.mode === "rss" ? parseRss(body) : parseHtml(body, feed.url);

      const seen = new Set<string>();
      const announcements: TempleAnnouncement[] = [];
      for (const item of raw) {
        const title = item.title;
        if (!usable(title, source)) continue;
        const key = title.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const url = /^https:\/\//i.test(item.url) ? item.url : source.site;
        announcements.push({
          templeId: source.id,
          temple: source.name,
          city: source.city,
          region: source.region,
          title,
          url,
          date: item.date,
        });
        if (announcements.length >= 12) break;
      }
      if (announcements.length > 0) return { source, announcements, ok: true };
    } catch (err) {
      console.error(`temple feed failed for ${source.id} (${feed.url})`, err);
    }
  }
  return { source, announcements: [], ok: false };
}

/** Fetch every temple in parallel; one slow or dead site never blocks the rest. */
export async function fetchAllTemples(): Promise<TempleFeedResult[]> {
  return Promise.all(TEMPLE_SOURCES.map(fetchSource));
}
