/**
 * India desk ingest.
 *
 * The India sections (national, Telangana, Andhra, immigration, NRI) used to be
 * collected inside the shared news pass, at the tail of a time-boxed budget:
 * when the Bay Area / guide / topic passes ran long, the India publishers were
 * never read at all and the desk went stale for days.
 *
 * This module reads the India publishers on their own schedule, each inside its
 * own try/catch, and records one `ingest_runs` row per source. One broken feed
 * can no longer abort the batch. Publishers are read through their official RSS
 * where one exists; the rest come through a news search.
 *
 * Server-only.
 */
import { classifyIndia } from "./india-topics";
import { logIngestRuns, type IngestRunRow } from "./ingest-runs.server";
import { urlKey, fetchArticleImage } from "./collect-news.server";
import { usableImage } from "./story-image";
import { ingest } from "./cms.server";

export type IndiaFeed = {
  name: string;
  url: string;
  /** Section hint used only when the classifier cannot decide. */
  fallback: "india-national" | "india-telangana" | "india-andhra" | "india-immigration" | "india-nri";
  limit?: number;
  match?: RegExp;
  /** Links matching this pattern belong to another desk and are skipped. */
  skipLink?: RegExp;
};

/**
 * Official publisher RSS first (The Hindu, Times of India, Deccan Chronicle,
 * Telangana Today, Hans India, American Bazaar, NDTV, USCIS, Murthy,
 * Immigration.com); Google News search only where the publisher has no feed.
 */
export const INDIA_FEEDS: IndiaFeed[] = [
  // National
  {
    name: "The Hindu",
    url: "https://www.thehindu.com/news/national/feeder/default.rss",
    fallback: "india-national",
    limit: 8,
  },
  {
    name: "The Times of India",
    url: "https://timesofindia.indiatimes.com/rssfeedstopstories.cms",
    fallback: "india-national",
    limit: 8,
  },
  {
    name: "NDTV India",
    url: "https://feeds.feedburner.com/ndtvnews-india-news",
    fallback: "india-national",
    limit: 8,
  },
  {
    name: "Deccan Chronicle",
    url: "https://www.deccanchronicle.com/google_feeds.xml",
    fallback: "india-national",
    limit: 10,
  },
  // Telangana / Hyderabad
  {
    name: "The Hindu (Telangana)",
    url: "https://www.thehindu.com/news/national/telangana/feeder/default.rss",
    fallback: "india-telangana",
    limit: 8,
  },
  {
    name: "The Hindu (Hyderabad)",
    url: "https://www.thehindu.com/news/cities/Hyderabad/feeder/default.rss",
    fallback: "india-telangana",
    limit: 8,
  },
  {
    name: "The Times of India (Hyderabad)",
    url: "https://timesofindia.indiatimes.com/rssfeeds/-2128816011.cms",
    fallback: "india-telangana",
    limit: 8,
  },
  {
    name: "Telangana Today",
    url: "https://telanganatoday.com/feed",
    fallback: "india-telangana",
    limit: 10,
  },
  {
    name: "The Hans India (Telangana)",
    url: "https://www.thehansindia.com/rss/telangana",
    fallback: "india-telangana",
    limit: 8,
  },
  // Andhra Pradesh / Amaravati
  {
    name: "The Hindu (Andhra Pradesh)",
    url: "https://www.thehindu.com/news/national/andhra-pradesh/feeder/default.rss",
    fallback: "india-andhra",
    limit: 8,
  },
  {
    name: "The Hans India (Andhra Pradesh)",
    url: "https://www.thehansindia.com/rss/andhra-pradesh",
    fallback: "india-andhra",
    limit: 8,
  },
  {
    // The Hindu's Amaravati city desk: the Andhra capital's own coverage,
    // separate from the statewide feed above.
    name: "The Hindu (Amaravati)",
    url: "https://www.thehindu.com/news/cities/Vijayawada/feeder/default.rss",
    fallback: "india-andhra",
    limit: 6,
  },

  // NRI / Indian-American press
  {
    name: "The American Bazaar",
    url: "https://americanbazaaronline.com/feed/",
    fallback: "india-nri",
    limit: 8,
  },
  {
    name: "The Times of India (NRI)",
    url: "https://timesofindia.indiatimes.com/rssfeeds/7098551.cms",
    fallback: "india-nri",
    limit: 8,
  },
  // NOTE: TeluguTimes.net India feeds were removed from active ingestion on
  // 2026-09-03. Existing published stories remain live; new stories are sourced
  // from Indian-American and Bay Area community publishers instead.
  {
    name: "New India Abroad",
    url: "https://news.google.com/rss/search?q=site%3Anewindiaabroad.com+when%3A7d&hl=en-US&gl=US&ceid=US%3Aen",
    fallback: "india-nri",
    limit: 6,
  },
  {
    name: "India West",
    url: "https://news.google.com/rss/search?q=site%3Aindiawest.com+when%3A7d&hl=en-US&gl=US&ceid=US%3Aen",
    fallback: "india-nri",
    limit: 6,
  },
  // Immigration and consular
  {
    name: "USCIS",
    url: "https://www.uscis.gov/news/rss-feed/59144",
    fallback: "india-immigration",
    limit: 6,
    match: /visa|green card|h.?1b|immigrat|citizenship|naturaliz|uscis|fee|eb.?[23]|opt\b|status/i,
  },
  {
    name: "Murthy Law Firm",
    url: "https://www.murthy.com/feed/",
    fallback: "india-immigration",
    limit: 6,
  },
  {
    name: "Immigration.com",
    url: "https://www.immigration.com/rss.xml",
    fallback: "india-immigration",
    limit: 6,
  },
];

/**
 * Advisory notices (USCIS bulletins, law-firm updates) publish text without
 * artwork, and the site's "no image, no story" rule drops them. They are read
 * every cycle and their failures still alert, but an empty run is normal for
 * them and must not raise a daily false alarm.
 */
export const QUIET_SOURCES = new Set(["USCIS", "Murthy Law Firm", "Immigration.com"]);



const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36 BayAreaTeluguTimes/1.0";
const MAX_AGE_DAYS = 4;

type Parsed = {
  title: string;
  link: string;
  source: string;
  published: string | null;
  image: string | null;
  summary: string;
};

function tag(block: string, name: string): string {
  const m =
    block.match(new RegExp(`<${name}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>`, "i")) ??
    block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return (m?.[1] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function imageOf(block: string): string | null {
  const candidates = [
    block.match(/<media:content[^>]+url="([^"]+)"/i)?.[1],
    block.match(/<media:thumbnail[^>]+url="([^"]+)"/i)?.[1],
    block.match(/<enclosure[^>]+url="([^"]+)"/i)?.[1],
    block.match(/<image>\s*<url>([^<]+)<\/url>/i)?.[1],
    block.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1],
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    const ok = usableImage(c.replace(/&amp;/g, "&"));
    if (ok) return ok;
  }
  return null;
}

function parseFeed(xml: string): Parsed[] {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  const out: Parsed[] = [];
  for (const b of blocks) {
    const title = tag(b, "title");
    const link = tag(b, "link") || b.match(/<link[^>]+href="([^"]+)"/i)?.[1] || "";
    if (!title || !link) continue;
    const pub = tag(b, "pubDate") || tag(b, "updated") || tag(b, "published") || tag(b, "dc:date");
    const parsedDate = pub ? new Date(pub) : null;
    out.push({
      title,
      link: link.trim(),
      source: tag(b, "source") || "",
      published: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null,
      image: imageOf(b),
      summary: tag(b, "description") || tag(b, "summary") || "",
    });
  }
  return out;
}

function recent(iso: string | null): boolean {
  if (!iso) return true;
  return Date.now() - Date.parse(iso) <= MAX_AGE_DAYS * 86_400_000;
}

async function readFeed(feed: IndiaFeed): Promise<Parsed[]> {
  const res = await fetch(feed.url, {
    headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, */*" },
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const xml = await res.text();
  const items = parseFeed(xml);
  if (!items.length) throw new Error("feed returned no items");
  const seen = new Set<string>();
  const kept: Parsed[] = [];
  for (const item of items) {
    const hay = `${item.title} ${item.summary}`;
    if (feed.match && !feed.match.test(hay)) continue;
    if (feed.skipLink?.test(item.link)) continue;
    if (!recent(item.published)) continue;
    const key = urlKey(item.link);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(item);
    if (kept.length >= (feed.limit ?? 6)) break;
  }
  return kept;
}

export type IndiaIngestSummary = {
  runId: string;
  sources: {
    source: string;
    status: "ok" | "failed";
    found: number;
    inserted: number;
    error: string | null;
  }[];
  inserted: number;
  failed: number;
};

/**
 * Reads every India publisher (or one, when `source` is given), inserts new
 * items and logs the outcome per source.
 *
 * De-duplication happens at three levels: canonical URL against what is
 * already stored, canonical URL within the run, and the existing
 * title/body duplicate guard inside `ingest()`.
 */
export async function runIndiaIngest(opts?: {
  source?: string;
  trigger?: string;
  budgetMs?: number;
}): Promise<IndiaIngestSummary> {
  const runId = crypto.randomUUID();
  const trigger = opts?.trigger ?? "cron";
  const deadline = Date.now() + Math.min(Math.max(opts?.budgetMs ?? 70_000, 5_000), 110_000);
  const feeds = opts?.source ? INDIA_FEEDS.filter((f) => f.name === opts.source) : INDIA_FEEDS;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Canonical URLs already stored, so a re-run never re-inserts a story.
  const knownUrls = new Set<string>();
  const { data: recentRows } = await supabaseAdmin
    .from("content_items")
    .select("link_url")
    .not("link_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(4000);
  for (const r of recentRows ?? []) if (r.link_url) knownUrls.add(urlKey(r.link_url));

  const logs: IngestRunRow[] = [];
  const summary: IndiaIngestSummary["sources"] = [];

  for (const feed of feeds) {
    const startedAt = new Date().toISOString();
    if (Date.now() > deadline) {
      logs.push({
        run_id: runId,
        mode: "india",
        source: feed.name,
        category: feed.fallback,
        status: "skipped",
        error: "run budget exhausted",
        trigger,
        started_at: startedAt,
      });
      continue;
    }
    try {
      const items = await readFeed(feed);
      const fresh = items.filter((i) => {
        const key = urlKey(i.link);
        if (knownUrls.has(key)) return false;
        knownUrls.add(key);
        return true;
      });

      // Every card needs artwork: use the feed image, else read the article.
      const rows = [] as Parameters<typeof ingest>[0];
      for (const item of fresh) {
        const image = item.image ?? (await fetchArticleImage(item.link).catch(() => null));
        if (!usableImage(image)) continue;
        // The classifier decides the section; the feed's own desk is the
        // fallback so a Telangana story never lands outside the India desk.
        const section = classifyIndia(item.title, item.summary, item.link) ?? feed.fallback;
        rows.push({
          source: `india:${feed.name}`,
          source_ref: `india:${urlKey(item.link)}`,
          kind: "news",
          title: item.title,
          summary: item.summary.slice(0, 600),
          link_url: item.link,
          image_url: usableImage(image),
          category: section,
          published_at: item.published,
        });
      }

      const result = rows.length ? await ingest(rows) : { inserted: 0 };
      summary.push({
        source: feed.name,
        status: "ok",
        found: items.length,
        inserted: result.inserted,
        error: null,
      });
      logs.push({
        run_id: runId,
        mode: "india",
        source: feed.name,
        category: feed.fallback,
        status: "ok",
        items_found: items.length,
        items_inserted: result.inserted,
        trigger,
        started_at: startedAt,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`India ingest failed for ${feed.name}:`, message);
      summary.push({ source: feed.name, status: "failed", found: 0, inserted: 0, error: message });
      logs.push({
        run_id: runId,
        mode: "india",
        source: feed.name,
        category: feed.fallback,
        status: "failed",
        error: message,
        trigger,
        started_at: startedAt,
      });
    }
  }

  await logIngestRuns(logs);
  return {
    runId,
    sources: summary,
    inserted: summary.reduce((n, s) => n + s.inserted, 0),
    failed: summary.filter((s) => s.status === "failed").length,
  };
}
