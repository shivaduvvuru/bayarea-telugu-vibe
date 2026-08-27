import { BAY_AREA, CITIES, cityBySlug, type City } from "./desk-cities";
import { canonicalUrl, dedupeKey, strictTitleKey } from "./dedupe";
import { isTempleNewsClean } from "./temple-purity";
import { usableImage } from "./story-image";
import {
  celebrityName,
  industryLabel,
  eventLabel,
  isCinema,
  isStarGallery,
  classifyDeskItem,
  CINEMA_SLUG,
  type ClassifyReason,
  type DeskCategory,
} from "./cinema-topics";
import { MICRO_DRAMA_SLUG } from "./microdrama-topics";
import { resolveGoogleNewsLinks, isGoogleNewsLink, RESOLVE_CONCURRENCY } from "./google-resolve.server";
import { classifyIndia } from "./india-topics";
import {
  resolveGoogleNewsUrls,
  resolveGoogleNewsUrl,
  isGoogleNewsUrl,
} from "./google-news.server";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { generateText } from "ai";
import {
  averageBatchSize,
  callsPerHeadline,
  dedupeEntries,
  newBatchMetrics,
  runSummaryBatches,
  SUMMARY_CONCURRENCY,
  topSingleCallSources,
  truncationRate,
  type SummaryEntry,
} from "./summary-batch";
import { recordSummaryRun } from "./summary-metrics.server";
import { mapWithLimit, withRetry } from "./retry";

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

/** No placeholder asset exists in the site; a null image renders the typographic card. */
const DESK_PLACEHOLDER_IMAGE: string | null = null;

/**
 * Stories the site already carries, for the run in progress. Set once at the
 * start of collectAll / collectDesk and consulted by addImages so an article
 * page is never fetched for a headline that will be discarded as a duplicate.
 */
let runKnown: Set<string> | null = null;
/** Article pages fetched for artwork at once. Unbounded parallelism tripped publisher rate limits. */
const IMAGE_FETCH_CONCURRENCY = 6;
/** Feed descriptions at least this long stand in for a model summary. */
const MIN_DESCRIPTION_CHARS = 60;
const MAX_DESCRIPTION_CHARS = 280;

/** RSS description trimmed to one clean sentence-ish block, or null when too thin to use. */
function descriptionSummary(detail: string | undefined, title: string): string | null {
  if (!detail) return null;
  let text = detail.replace(/\s+/g, " ").trim();
  if (text.length < MIN_DESCRIPTION_CHARS) return null;
  // Many feeds repeat the headline as the first sentence.
  const t = title.trim();
  if (t && text.toLowerCase().startsWith(t.toLowerCase())) text = text.slice(t.length).replace(/^[\s:.\-–—]+/, "");
  if (text.length < MIN_DESCRIPTION_CHARS) return null;
  if (/read more|click here|continue reading|the post .* appeared first/i.test(text)) {
    text = text.replace(/\s*(?:read more|click here|continue reading|the post .* appeared first).*$/i, "").trim();
  }
  if (text.length > MAX_DESCRIPTION_CHARS) {
    const cut = text.slice(0, MAX_DESCRIPTION_CHARS);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
    text = end > MIN_DESCRIPTION_CHARS ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`;
  }
  return text.length >= MIN_DESCRIPTION_CHARS ? text : null;
}

/** Hostname as a last-resort publisher label. */
function safeHost(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return "Web";
  }
}

function storyUrlKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return canonicalUrl(raw) ?? urlKey(raw);
}

export function storyIdentityKeys(title: string | null | undefined, url: string | null | undefined): string[] {
  const u = storyUrlKey(url);
  const t = strictTitleKey(title);
  if (u) return [`u:${u}`, ...(t ? [`ut:${u}|${t}`] : [])];
  return t ? [`t:${t}`] : [];
}

function itemDedupeKey(citySlug: string, title: string, url: string | null | undefined): string {
  const u = storyUrlKey(url);
  const t = strictTitleKey(title) ?? normalize(title);
  return keyFor(citySlug, u ? `${u}|${t}` : t);
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
  /** True when a Google News wrapper could not be resolved to a publisher URL. */
  unresolved?: boolean;
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
      signal: AbortSignal.timeout(5000),
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
 * Publisher-agnostic repair: any published story stored without artwork gets its
 * original photo fetched from the article page. AndhraWishesh was one symptom;
 * every source that omits social metadata on first collection is repaired here.
 */
export async function backfillMissingImages(
  admin: {
    from: (table: string) => {
      select: (columns: string) => any;
      update: (values: Record<string, unknown>) => any;
    };
  },
  limit = 60,
): Promise<{ scanned: number; repaired: number }> {
  const { data, error } = await admin
    .from("content_items")
    .select("id, link_url, image_url, created_at, image_backfill_attempts")
    .eq("status", "published")
    .is("image_url", null)
    .not("link_url", "is", null)
    // Pages that failed five times are unrecoverable: stop spending the budget
    // on them so the scan keeps reaching stories that can still be repaired.
    .or("image_backfill_attempts.is.null,image_backfill_attempts.lt.5")
    .order("created_at", { ascending: false })
    .limit(limit * 8);
  if (error) return { scanned: 0, repaired: 0 };
  // Sample across the whole image-less backlog: a fixed newest-first slice keeps
  // retrying the same unrecoverable pages and never reaches older stories.
  const pool = (data ?? []) as {
    id: string;
    link_url: string | null;
    image_backfill_attempts?: number | null;
  }[];
  const rows = pool
    .map((row) => ({ row, r: Math.random() }))
    .sort((a, b) => a.r - b.r)
    .slice(0, limit)
    .map((x) => x.row);
  let repaired = 0;
  // Small concurrency keeps the run inside the request budget while still
  // clearing the backlog across successive refreshes.
  const queue = [...rows];
  const workers = Array.from({ length: 6 }, async () => {
    for (;;) {
      const row = queue.shift();
      if (!row?.link_url) return;
      const image = await fetchArticleImage(row.link_url).catch(() => null);
      if (!image) {
        // Record the failed attempt so the guard above can retire the row.
        await admin
          .from("content_items")
          .update({ image_backfill_attempts: (row.image_backfill_attempts ?? 0) + 1 })
          .eq("id", row.id);
        continue;
      }
      const { error: upErr } = await admin
        .from("content_items")
        .update({ image_url: image })
        .eq("id", row.id);
      if (!upErr) repaired += 1;
    }
  });
  await Promise.all(workers);
  return { scanned: rows.length, repaired };
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
      signal: AbortSignal.timeout(5000),
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
    // Publishers use lazy-loading attributes and both quote styles. Reading
    // only double-quoted `src` skipped the actual frame on photo-gallery pages
    // such as AndhraWishesh and left an otherwise valid headline image-less.
    for (const m of html.matchAll(
      /<img[^>]+(?:src|data-src|data-original|data-lazy-src)\s*=\s*["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["']/gi,
    )) {
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
      // Avoid mixed-content failures when an older publisher emits an http
      // image from a page that is already available over https.
      if (new URL(res.url || link).protocol === "https:" && abs.startsWith("http://")) {
        abs = `https://${abs.slice("http://".length)}`;
      }
      const usable = cleanUrl(abs);
      if (!usable) continue;
      let score = 0;
      if (/(?:large|full|original|1200|1080|orig|hd)/i.test(usable)) score += 3;
      if (/\/(?:images?|photos?|uploads?|gallery)\//i.test(usable)) score += 1;
      if (/\/phocagallery\//i.test(usable) && !/\/thumbs\//i.test(usable)) score += 8;
      if (/\/thumbs?\//i.test(usable)) score -= 5;
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
    // Publisher from <source>, else the " - Publisher" suffix Google adds —
    // never the headline itself (that was showing up as the source on cards).
    const parts = rawTitle.split(" - ");
    const source = tag(b, "source") || (parts.length > 1 ? parts[parts.length - 1]!.trim() : "");
    const title = rawTitle
      .replace(source ? new RegExp(`\\s-\\s${source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) : /$^/, "")
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
  /** Per-publisher news diagnostics for the latest collection run. */
  publishers: {
    selected: [] as string[],
    bySource: {} as Record<
      string,
      {
        requests: number;
        returned: number;
        kept: number;
        withImage: number;
        cinema: number;
        microDrama: number;
        gallery: number;
        other: number;
        error?: string;
      }
    >,
  },
  /** Google News health for this run: source sweeps requested vs items returned. */
  googleNews: {
    requested: 0,
    fetched: 0,
    returned: 0,
    errors: {} as Record<string, number>,
    bySource: {} as Record<string, { requested: number; fetched: number; returned: number; errors: Record<string, number> }>,
  },
  /** Picture-intake funnel for the ingestion dashboard. */
  gallery: {
    discovered: 0,
    noImage: 0,
    imageUnusable: 0,
    hardNews: 0,
    candidates: 0,
    bySource: {} as Record<string, { discovered: number; candidates: number }>,
  },
  /** Publish-time routing expected from this collector run. */
  classification: {
    byCategory: {} as Record<string, number>,
    bySource: {} as Record<string, Record<string, number>>,
    byReason: {} as Record<string, number>,
    unresolvedLinks: 0,
  },
  /** Summary model metrics copied onto collect_runs for the last-30 dashboard. */
  summary: {
    calls: 0,
    calls_per_headline: 0,
    avg_batch_size: 0,
    fallback_calls: 0,
    total_headlines: 0,
    batches: 0,
  },
};

function resetRunDiagnostics(opts: { keepGallery?: boolean } = {}) {
  googleFailures = 0;
  lastDiag.fetched = 0;
  lastDiag.raw = 0;
  lastDiag.kept = 0;
  lastDiag.images = 0;
  lastDiag.duplicates = 0;
  lastDiag.notes = [];
  lastDiag.publishers = { selected: [], bySource: {} };
  lastDiag.googleNews = { requested: 0, fetched: 0, returned: 0, errors: {}, bySource: {} };
  lastDiag.classification = { byCategory: {}, bySource: {}, byReason: {}, unresolvedLinks: 0 };
  lastDiag.summary = {
    calls: 0,
    calls_per_headline: 0,
    avg_batch_size: 0,
    fallback_calls: 0,
    total_headlines: 0,
    batches: 0,
  };
  if (!opts.keepGallery) {
    lastDiag.gallery = {
      discovered: 0,
      noImage: 0,
      imageUnusable: 0,
      hardNews: 0,
      candidates: 0,
      bySource: {},
    };
  }
}

function resetAiUsage() {
  aiUsage.calls = 0;
  aiUsage.itemsSummarized = 0;
  aiUsage.itemsSkipped = 0;
  aiUsage.batches = 0;
  aiBatchMetrics = newBatchMetrics();
}

function syncSummaryDiag() {
  lastDiag.summary = {
    calls: aiUsage.calls,
    calls_per_headline: Number(callsPerHeadline(aiBatchMetrics)),
    avg_batch_size: Number(averageBatchSize(aiBatchMetrics)),
    fallback_calls: aiBatchMetrics.fallbackCalls,
    total_headlines: aiUsage.itemsSummarized,
    batches: aiUsage.batches,
  };
}

function recordClassified(source: string, category: string, reason?: ClassifyReason) {
  lastDiag.classification.byCategory[category] =
    (lastDiag.classification.byCategory[category] ?? 0) + 1;
  const bySource = (lastDiag.classification.bySource[source] ??= {});
  bySource[category] = (bySource[category] ?? 0) + 1;
  if (reason)
    lastDiag.classification.byReason[reason] =
      (lastDiag.classification.byReason[reason] ?? 0) + 1;
}

/**
 * Resolve Google News wrappers to publisher URLs before anything classifies on
 * host. Cached in url_resolutions, concurrency 8; a failure leaves the wrapper
 * in place and flags the item unresolved so the classifier ignores the host.
 */
async function resolveWrappedLinks(items: RawItem[]): Promise<void> {
  const wrapped = items.filter((i) => i.link && isGoogleNewsLink(i.link));
  if (!wrapped.length) return;
  const map = await resolveGoogleNewsLinks(wrapped.map((i) => i.link));
  for (const item of wrapped) {
    const res = map.get(item.link);
    if (res && !res.unresolved && res.url !== item.link) {
      item.link = res.url;
      item.unresolved = false;
    } else {
      item.unresolved = true;
      lastDiag.classification.unresolvedLinks += 1;
    }
  }
}

/**
 * Google News circuit breaker. Google tarpits a busy client with silent
 * timeouts rather than a 429; once a few requests in a run have timed out,
 * every remaining Google request is skipped so the budget goes to publishers
 * that are answering. Reset per run.
 */
const GOOGLE_TRIP_AFTER = 3;
let googleFailures = 0;
/**
 * Run clocks. The hook is called by pg_net with a hard 120 s limit and the
 * run log is only written at the end, so a slow run must degrade — skip
 * artwork, skip the model, leave publishing for the next slot — rather than
 * overrun. Fetching and artwork stop at `fetchDeadline`; model summaries stop
 * at `modelDeadline`; the route stops publishing at its own cut-off.
 */
let fetchDeadline = Number.POSITIVE_INFINITY;
let modelDeadline = Number.POSITIVE_INFINITY;
const pastFetch = () => Date.now() > fetchDeadline;
const pastModel = () => Date.now() > modelDeadline;
/** Extra time the summary phase gets after fetching stops. */
const MODEL_PHASE_MS = 25_000;
/** How long a Google URL-resolution batch may take before it trips the breaker. */
const RESOLVE_TIMEOUT_MS = 12_000;
function googleDown(): boolean {
  return googleFailures >= GOOGLE_TRIP_AFTER;
}

function isGoogleNewsFeed(url: string): boolean {
  try {
    return new URL(url).hostname === "news.google.com";
  } catch {
    return false;
  }
}

function googleDiag(label: string) {
  return (lastDiag.googleNews.bySource[label] ??= { requested: 0, fetched: 0, returned: 0, errors: {} });
}

function recordGoogleError(label: string, status: string) {
  lastDiag.googleNews.errors[status] = (lastDiag.googleNews.errors[status] ?? 0) + 1;
  const stat = googleDiag(label);
  stat.errors[status] = (stat.errors[status] ?? 0) + 1;
}

function formatCountMap(counts: Record<string, number>): string {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => `${key}:${count}`)
    .join(", ");
}

function googleNewsSummaryNote(): string {
  const errors = formatCountMap(lastDiag.googleNews.errors);
  const cinema = Object.entries(lastDiag.googleNews.bySource).filter(([name]) => {
    const feed = PUBLISHER_FEEDS.find((f) => f.name === name);
    return feed ? isCinemaPublisher(feed) : /cinema|ott|micro|drama|topic:news/i.test(name);
  });
  const cinemaRequested = cinema.reduce((sum, [, stat]) => sum + stat.requested, 0);
  const cinemaFetched = cinema.reduce((sum, [, stat]) => sum + stat.fetched, 0);
  const cinemaReturned = cinema.reduce((sum, [, stat]) => sum + stat.returned, 0);
  return (
    `Google News: ${lastDiag.googleNews.fetched}/${lastDiag.googleNews.requested} feeds succeeded, ` +
    `${lastDiag.googleNews.returned} items returned` +
    (errors ? `, errors ${errors}` : "") +
    `; Cinema/OTT Google sweeps: ${cinemaFetched}/${cinemaRequested} feeds succeeded, ${cinemaReturned} items returned`
  );
}

function publisherDiag(name: string) {
  return (lastDiag.publishers.bySource[name] ??= {
    requests: 0,
    returned: 0,
    kept: 0,
    withImage: 0,
    cinema: 0,
    microDrama: 0,
    gallery: 0,
    other: 0,
  });
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function fetchFeed(url: string, opts: { label?: string } = {}): Promise<RawItem[] | null> {
  const google = isGoogleNewsFeed(url);
  const label = opts.label ?? (google ? "Google News" : new URL(url).host);
  if (google) {
    lastDiag.googleNews.requested += 1;
    googleDiag(label).requested += 1;
    if (googleDown()) {
      recordGoogleError(label, "skipped: circuit open");
      return null;
    }
  }
  try {
    const res = await withRetry(
      async () => {
        const response = await fetch(url, {
          headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, */*" },
          // Google search RSS is routinely 6-8s from this region; the circuit
          // breaker caps how much a slow Google can cost a run.
          signal: AbortSignal.timeout(google ? 10_000 : 5_000),
        });
        if (!response.ok) {
          const error = new Error(`HTTP ${response.status} ${new URL(url).host}`) as Error & {
            status?: number;
            headers?: Headers;
          };
          error.status = response.status;
          error.headers = response.headers;
          throw error;
        }
        return response;
      },
      {
        // Google is either fast or tarpitting; a long retry ladder only
        // burns the run budget. Two tries, short backoff, then the breaker.
        attempts: 2,
        baseMs: google ? 600 : 800,
        maxMs: google ? 2_000 : 5_000,
        label: google ? `Google News ${label}` : label,
        log: (line) => {
          if (google || lastDiag.notes.length < 6) console.warn(line);
        },
      },
    );
    const items = parseRss(await res.text());
    if (google) {
      lastDiag.googleNews.fetched += 1;
      lastDiag.googleNews.returned += items.length;
      const stat = googleDiag(label);
      stat.fetched += 1;
      stat.returned += items.length;
    }
    // Google wrappers are resolved later, in addImages, for kept items only —
    // resolving all ~100 items of every search feed was most of the run time.
    return items;
  } catch (e) {
    if (google) {
      googleFailures += 1;
      recordGoogleError(label, e instanceof Error ? (e.message.match(/\b\d{3}\b/)?.[0] ?? e.message) : String(e));
      if (googleFailures === GOOGLE_TRIP_AFTER) lastDiag.notes.push("Google News: circuit opened after repeated timeouts; remaining Google feeds skipped this run");
    }
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
        { label: `city:${city.slug}:bing` },
      );
      if (!parsed?.length) {
        parsed =
          (await fetchFeed(
            `https://news.google.com/rss/search?q=${encodeURIComponent(q)}+when:2d&hl=en-US&gl=US&ceid=US:en`,
            { label: `city:${city.slug}:google` },
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

/**
 * Feeds rarely carry artwork, so read the article page for og:image.
 * Skipped for anything the site already knows (those rows are dropped as
 * duplicates downstream) and run with bounded concurrency.
 */
async function addImages(items: RawItem[]): Promise<void> {
  const isKnown = (item: RawItem) => {
    if (!runKnown) return false;
    if (storyIdentityKeys(item.title, item.link).some((k) => runKnown!.has(k))) return true;
    // Google-wrapped links never match a stored publisher URL; the title does.
    const t = strictTitleKey(item.title);
    return !!t && runKnown.has(`t:${t}`);
  };
  const todo = items.filter((item) => {
    if (isKnown(item)) {
      item.image = usableImage(item.image);
      return false;
    }
    return true;
  });
  // One batched resolution for the kept Google-wrapped links.
  const wrapped = todo.filter((i) => i.link && isGoogleNewsUrl(i.link)).map((i) => i.link);
  if (wrapped.length && !googleDown()) {
    const map = await Promise.race([
      resolveGoogleNewsUrls(wrapped),
      new Promise<Map<string, string>>((resolve) =>
        setTimeout(() => {
          googleFailures = Math.max(googleFailures, GOOGLE_TRIP_AFTER);
          lastDiag.notes.push("Google News: URL resolution timed out; circuit opened");
          resolve(new Map());
        }, RESOLVE_TIMEOUT_MS),
      ),
    ]).catch(() => new Map<string, string>());
    for (const item of todo) {
      const real = map.get(item.link);
      if (real && real !== item.link) item.link = real;
    }
    // A resolved link may now match a stored story after all.
    for (const item of todo) if (isKnown(item)) item.image = usableImage(item.image);
  }
  await mapWithLimit(todo.filter((i) => !isKnown(i)), IMAGE_FETCH_CONCURRENCY, async (item) => {
    if (pastFetch()) {
      // Out of time: the card renders typographically; backfill can add art later.
      item.image = usableImage(item.image);
      return;
    }
    // Patch only ever exposes its own "Patch AM" logo, so skip artwork here
    // and let the story render as a typographic card.
    if (/patch/i.test(item.source) || /patch\.com/i.test(item.link)) {
      item.image = null;
      return;
    }
    if (item.link && isGoogleNewsUrl(item.link)) {
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
  }, { label: "article images" });
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
      "ReelShort OR DramaBox short drama actress photos glamour",
      "China duanju short drama actress star photos",
      "India micro drama heroine actress vertical series photos",
    ],
    match:
      /micro[- ]?drama|short[- ]?drama|vertical (?:drama|series|video)|reelshort|dramabox|flickreels|dramawave|goodshort|shortmax|holywater|flick ?tv|pocket ?fm|kuku ?fm|duanju|micro ?series/,
  },
];

const TOPIC_MAX = 8;
const DESK_TOPIC_MAX: Record<string, number> = {
  cinema: 40,
  "micro-drama": 20,
};

function topicDesk(group: (typeof TOPIC_GROUPS)[number]): "cinema" | "micro-drama" | "other" {
  const text = `${group.queries.join(" ")} ${group.match.source}`;
  if (/micro|vertical|reelshort|dramabox|duanju|short[- ]?drama/i.test(text)) return "micro-drama";
  if (/cinema|movie|film|ott|stream|tollywood|bollywood|hollywood|web series/i.test(text)) return "cinema";
  return "other";
}

async function fetchTopics(
  group: (typeof TOPIC_GROUPS)[number],
  opts?: { limit?: number },
): Promise<RawItem[]> {
  const JUNK = /obituary|obituaries|death notice|horoscope|lottery|box score/;
  const results = await Promise.all(
    group.queries.map(async (q) => {
      let parsed = await fetchFeed(
        `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=RSS&cc=us&setmkt=en-us&setlang=en-us`,
        { label: `topic:${group.kind}:bing` },
      );
      if (!parsed?.length) {
        parsed =
          (await fetchFeed(
            `https://news.google.com/rss/search?q=${encodeURIComponent(q)}+when:7d&hl=en-US&gl=US&ceid=US:en`,
            { label: `topic:${group.kind}:google` },
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
    merged.push(item.source ? item : { ...item, source: safeHost(item.link) });
    if (merged.length >= (opts?.limit ?? DESK_TOPIC_MAX[topicDesk(group)] ?? TOPIC_MAX)) break;
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
  {
    name: "Telugu Times Cinema",
    url: "https://www.telugutimes.net/en/cinemas/feed/",
    kind: "news",
    limit: 10,
  },
  { name: "123Telugu", url: "https://www.123telugu.com/feed", kind: "news", limit: 12 },
  { name: "Gulte", url: "https://www.gulte.com/feed", kind: "news", limit: 12 },
  { name: "GreatAndhra", url: "https://www.greatandhra.com/rss/rssfeed.php", kind: "news", limit: 12 },
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
  { name: "M9 News", url: "https://www.m9.news/feed", kind: "news", limit: 12 },
  { name: "Mirchi9", url: "https://www.mirchi9.com/feed", kind: "news", limit: 12 },
  { name: "Telugu360", url: "https://www.telugu360.com/feed", kind: "news", limit: 12 },
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
  // Wider glamour intake beyond film: OTT / streaming, vertical micro-drama and
  // social-media creators. Every row still passes the picture-quality and
  // female-subject gates, and the editor can cut anything unsuitable at the desk.
  {
    name: "OTT & streaming actresses",
    url: "https://news.google.com/rss/search?q=(%22web+series%22+OR+OTT+OR+Netflix+OR+%22Prime+Video%22+OR+Hotstar+OR+ZEE5+OR+SonyLIV+OR+Aha)+(actress+OR+heroine+OR+star)+(photos+OR+pics+OR+stills+OR+gallery+OR+photoshoot+OR+%22new+look%22)+when:7d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 14,
  },
  {
    name: "Micro-drama actresses gallery",
    url: "https://news.google.com/rss/search?q=(%22micro+drama%22+OR+%22vertical+drama%22+OR+%22short+drama%22+OR+ReelShort+OR+DramaBox+OR+%22mini+series%22)+(actress+OR+heroine+OR+star+OR+lead)+(photos+OR+pics+OR+stills+OR+gallery+OR+photoshoot+OR+look)+when:14d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 12,
  },
  {
    name: "TV & anchor glamour",
    url: "https://news.google.com/rss/search?q=(%22TV+actress%22+OR+%22television+actress%22+OR+anchor+OR+%22Bigg+Boss%22+OR+%22reality+show%22)+(photos+OR+pics+OR+stills+OR+gallery+OR+photoshoot+OR+%22latest+look%22)+when:7d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 12,
  },
  {
    name: "Social media creators glamour",
    url: "https://news.google.com/rss/search?q=(influencer+OR+%22content+creator%22+OR+%22Instagram+star%22+OR+%22social+media+star%22+OR+%22reels+star%22+OR+youtuber)+(actress+OR+girl+OR+woman+OR+diva+OR+model)+(photos+OR+pics+OR+photoshoot+OR+%22viral+photos%22+OR+look)+when:7d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 12,
  },
  {
    name: "Models & fashion shoots",
    url: "https://news.google.com/rss/search?q=(model+OR+supermodel+OR+%22fashion+shoot%22+OR+%22magazine+cover%22+OR+%22cover+shoot%22+OR+%22ramp+walk%22)+(photos+OR+pics+OR+photoshoot+OR+gallery+OR+glamour)+when:7d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 10,
  },
  {
    name: "Dancers & performers glamour",
    url: "https://news.google.com/rss/search?q=(dancer+OR+singer+OR+%22item+song%22+OR+%22special+song%22+OR+performer)+(actress+OR+heroine+OR+girl)+(photos+OR+pics+OR+stills+OR+gallery+OR+photoshoot)+when:7d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 10,
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
  // ── South Korea (K-entertainment): drama actresses, idols, award red carpets
  // and agency photoshoot drops.
  {
    name: "K-drama actresses",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(
      '("K-drama" OR "Korean drama" OR "Korean actress") (photos OR pictorial OR photoshoot OR stills OR gallery OR "new look") when:7d',
    )}&hl=en-US&gl=US&ceid=US:en`,
    kind: "news",
    limit: 12,
  },
  {
    name: "K-pop female idols",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(
      '("K-pop" OR "girl group" OR idol) (member OR singer OR actress) (pictorial OR "concept photos" OR "teaser photos" OR photoshoot OR photos) when:7d',
    )}&hl=en-US&gl=US&ceid=US:en`,
    kind: "news",
    limit: 12,
  },
  {
    name: "Korean red carpets",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(
      '(Baeksang OR "Blue Dragon" OR "Grand Bell" OR "Asia Artist Awards" OR "Seoul International Drama Awards") (actress OR idol) (red carpet OR photos OR looks) when:14d',
    )}&hl=en-US&gl=US&ceid=US:en`,
    kind: "news",
    limit: 10,
  },
  {
    name: "K-entertainment pictorials (Bing)",
    url: "https://www.bing.com/news/search?q=(Korean+actress+OR+%22K-pop%22+idol)+(pictorial+OR+photoshoot+OR+%22magazine+cover%22)&format=RSS&cc=us&setmkt=en-us&setlang=en-us",
    kind: "news",
    limit: 10,
  },
  // ── USA / Hollywood: premieres, galas, press drops and studio photoshoots.
  {
    name: "Hollywood premieres & galas",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(
      '(actress OR star) ("movie premiere" OR "world premiere" OR "Met Gala" OR Oscars OR "Golden Globes" OR "Vanity Fair party" OR "fashion week") (red carpet OR photos OR look OR gown) when:14d',
    )}&hl=en-US&gl=US&ceid=US:en`,
    kind: "news",
    limit: 12,
  },
  {
    name: "Hollywood photoshoot galleries",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(
      '("Hollywood actress" OR "American actress" OR "movie star") (photoshoot OR "cover story" OR "magazine cover" OR "photo gallery" OR portrait) when:7d',
    )}&hl=en-US&gl=US&ceid=US:en`,
    kind: "news",
    limit: 12,
  },
  {
    name: "Hollywood press drops (Bing)",
    url: "https://www.bing.com/news/search?q=(Hollywood+actress+OR+%22leading+lady%22)+(%22red+carpet%22+OR+premiere+OR+photoshoot+OR+%22photo+gallery%22)&format=RSS&cc=us&setmkt=en-us&setlang=en-us",
    kind: "news",
    limit: 10,
  },
  // ── India: pageant and fashion circuits alongside the film desks.
  {
    name: "India pageant & fashion",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(
      '("Miss India" OR "Miss Universe" OR "Miss World" OR "Femina" OR "Lakme Fashion Week" OR "India Couture Week") (winner OR model OR actress) (photos OR gallery OR look OR gown) when:14d',
    )}&hl=en-IN&gl=IN&ceid=IN:en`,
    kind: "news",
    limit: 10,
  },

  // Direct "glamour + tollywood" keyword desks: one on Google News, one on Bing
  // News, both feeding the Glamour intake.
  // Broad discovery desks: fashion / beauty / portrait / lifestyle concepts,
  // not just explicit "glamour" wording. Volume first, editor decides.
  {
    name: "Fashion women (Google)",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(
      "fashion woman (photos OR photoshoot OR editorial) when:7d",
    )}&hl=en-US&gl=US&ceid=US:en`,
    kind: "news",
    limit: 12,
  },
  {
    name: "Female models (Google)",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(
      "female model (photoshoot OR portfolio OR runway OR photos) when:7d",
    )}&hl=en-US&gl=US&ceid=US:en`,
    kind: "news",
    limit: 12,
  },
  {
    name: "Beauty portraits (Google)",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(
      "beauty portrait woman (photos OR shoot) when:7d",
    )}&hl=en-US&gl=US&ceid=US:en`,
    kind: "news",
    limit: 12,
  },
  {
    name: "Female celebrities (Google)",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(
      "female celebrity (photos OR appearance OR look) when:7d",
    )}&hl=en-US&gl=US&ceid=US:en`,
    kind: "news",
    limit: 12,
  },
  {
    name: "Actress photos (Google)",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(
      "actress photos when:7d",
    )}&hl=en-US&gl=US&ceid=US:en`,
    kind: "news",
    limit: 12,
  },
  {
    name: "Modeling photography (Google)",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(
      "modeling photography woman when:7d",
    )}&hl=en-US&gl=US&ceid=US:en`,
    kind: "news",
    limit: 12,
  },
  {
    name: "Editorial portraits (Google)",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(
      "editorial portrait woman photography when:7d",
    )}&hl=en-US&gl=US&ceid=US:en`,
    kind: "news",
    limit: 12,
  },
  {
    name: "Women lifestyle (Google)",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(
      "women lifestyle (photos OR feature OR style) when:7d",
    )}&hl=en-US&gl=US&ceid=US:en`,
    kind: "news",
    limit: 12,
  },
  {
    name: "Red carpet women (Google)",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(
      "red carpet women (photos OR gown OR look) when:7d",
    )}&hl=en-US&gl=US&ceid=US:en`,
    kind: "news",
    limit: 12,
  },
  {
    name: "Female influencers (Google)",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(
      "female influencer (photos OR photoshoot OR viral) when:7d",
    )}&hl=en-US&gl=US&ceid=US:en`,
    kind: "news",
    limit: 12,
  },
  {
    name: "Fashion photography (Bing)",
    url: `https://www.bing.com/news/search?q=${encodeURIComponent(
      "fashion photography woman",
    )}&format=RSS&cc=us&setmkt=en-us&setlang=en-us`,
    kind: "news",
    limit: 12,
  },
  {
    name: "Beauty photography (Bing)",
    url: `https://www.bing.com/news/search?q=${encodeURIComponent(
      "beauty photography female model",
    )}&format=RSS&cc=us&setmkt=en-us&setlang=en-us`,
    kind: "news",
    limit: 12,
  },
  {
    name: "Portrait photography woman (Bing)",
    url: `https://www.bing.com/news/search?q=${encodeURIComponent(
      "portrait photography woman",
    )}&format=RSS&cc=us&setmkt=en-us&setlang=en-us`,
    kind: "news",
    limit: 12,
  },
  {
    name: "Women fashion week (Bing)",
    url: `https://www.bing.com/news/search?q=${encodeURIComponent(
      "women fashion week photos",
    )}&format=RSS&cc=us&setmkt=en-us&setlang=en-us`,
    kind: "news",
    limit: 12,
  },
  {
    name: "Glamour Tollywood (Google)",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(
      "glamour Tollywood (actress OR heroine) (photos OR stills OR gallery OR photoshoot) when:7d",
    )}&hl=en-US&gl=US&ceid=US:en`,
    kind: "news",
    limit: 10,
  },
  {
    name: "Glamour Tollywood (Bing)",
    url: `https://www.bing.com/news/search?q=${encodeURIComponent(
      "glamour Tollywood actress photos",
    )}&format=RSS&cc=us&setmkt=en-us&setlang=en-us`,
    kind: "news",
    limit: 10,
  },
  {
    name: "Glamour Telugu heroines (Bing)",
    url: `https://www.bing.com/news/search?q=${encodeURIComponent(
      "Telugu heroine glamour photoshoot stills",
    )}&format=RSS&cc=us&setmkt=en-us&setlang=en-us`,
    kind: "news",
    limit: 10,
  },
  // Google-search picture desks per South industry. Named-heroine sweeps pull
  // far more illustrated photo posts than generic "actress photos" queries,
  // which is what starved the Glamour folder.
  {
    name: "Tollywood heroine names",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(
      '("Samantha" OR "Rashmika Mandanna" OR "Pooja Hegde" OR "Sreeleela" OR "Krithi Shetty" OR "Anupama Parameswaran" OR "Nabha Natesh" OR "Kajal Aggarwal" OR "Sai Pallavi" OR "Nidhhi Agerwal") (photos OR stills OR gallery OR glamour OR photoshoot OR "new look") when:7d',
    )}&hl=en-IN&gl=IN&ceid=IN:en`,
    kind: "news",
    limit: 16,
  },
  {
    name: "Kollywood heroine names",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(
      '("Nayanthara" OR "Trisha" OR "Keerthy Suresh" OR "Sai Pallavi" OR "Aishwarya Rajesh" OR "Priya Bhavani Shankar" OR "Andrea Jeremiah" OR "Ritika Singh" OR "Amala Paul") (photos OR stills OR gallery OR glamour OR photoshoot OR "new look") when:7d',
    )}&hl=en-IN&gl=IN&ceid=IN:en`,
    kind: "news",
    limit: 16,
  },
  {
    name: "Mollywood heroine names",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(
      '("Manju Warrier" OR "Nazriya Nazim" OR "Ahaana Krishna" OR "Anna Ben" OR "Aparna Balamurali" OR "Malavika Mohanan" OR "Kalyani Priyadarshan" OR "Rajisha Vijayan" OR "Durga Krishna") (photos OR stills OR gallery OR glamour OR photoshoot OR "new look") when:7d',
    )}&hl=en-IN&gl=IN&ceid=IN:en`,
    kind: "news",
    limit: 16,
  },
  {
    name: "Sandalwood heroine names",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(
      '("Rachita Ram" OR "Rashmika Mandanna" OR "Ashika Ranganath" OR "Radhika Pandit" OR "Nishvika Naidu" OR "Sonu Gowda" OR "Milana Nagaraj" OR "Haripriya") (photos OR stills OR gallery OR glamour OR photoshoot OR "new look") when:7d',
    )}&hl=en-IN&gl=IN&ceid=IN:en`,
    kind: "news",
    limit: 16,
  },
  {
    name: "South glamour girls search",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(
      '(Tollywood OR Kollywood OR Mollywood OR Sandalwood) (heroine OR actress OR "glamour girl" OR model) ("glamorous photos" OR "hot photos" OR "saree photos" OR "photo shoot" OR "latest pics" OR "viral pics") when:3d',
    )}&hl=en-IN&gl=IN&ceid=IN:en`,
    kind: "news",
    limit: 18,
  },
  {
    name: "South heroine photoshoot search",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(
      '("Tamil actress" OR "Telugu actress" OR "Malayalam actress" OR "Kannada actress") ("photo gallery" OR "latest photos" OR "new stills" OR "glam look" OR "beach look" OR "traditional look") when:3d',
    )}&hl=en-IN&gl=IN&ceid=IN:en`,
    kind: "news",
    limit: 18,
  },

  {
    name: "గ్లామర్ ఫోటోలు",
    url: "https://news.google.com/rss/search?q=%E0%B0%97%E0%B1%8D%E0%B0%B2%E0%B0%BE%E0%B0%AE%E0%B0%B0%E0%B1%8D+%E0%B0%AB%E0%B1%8B%E0%B0%9F%E0%B1%8B%E0%B0%B2%E0%B1%81+OR+%E0%B0%85%E0%B0%82%E0%B0%A6%E0%B0%BE%E0%B0%B2+%E0%B0%A4%E0%B0%BE%E0%B0%B0+when:7d&hl=te&gl=IN&ceid=IN:te",
    kind: "news",
    limit: 6,
  },
  { name: "Pinkvilla", url: "https://www.pinkvilla.com/rss.xml", kind: "news", limit: 12 },
  // Micro-drama desk: Bing's news RSS stopped returning items, so these read
  // through Google News RSS, which answers with a deep pool of vertical
  // short-drama coverage from India, China and the US.
  {
    name: "Micro-drama wire",
    url: "https://news.google.com/rss/search?q=%22micro+drama%22+OR+%22microdrama%22+OR+%22short+drama%22+when:14d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 12,
  },
  {
    name: "ReelShort & DramaBox",
    url: "https://news.google.com/rss/search?q=ReelShort+OR+DramaBox+OR+FlickReels+OR+Holywater+OR+%22Flick+TV%22+when:14d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 10,
  },
  {
    name: "India short drama apps",
    url: "https://news.google.com/rss/search?q=(India+OR+Telugu+OR+Hindi)+(%22micro+drama%22+OR+%22short+drama%22+OR+%22vertical+drama%22+OR+%22Chai+Shots%22+OR+%22Pocket+FM%22+OR+%22Kuku+TV%22)+when:30d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 10,
  },
  {
    name: "China duanju short drama",
    url: "https://news.google.com/rss/search?q=%22vertical+drama%22+OR+duanju+OR+%22short-form+drama%22+OR+%22short+drama+industry%22+when:14d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 10,
  },
  // Chinese, Korean and Indian short-vertical coverage, read through both
  // Google News and Bing News so a single provider outage cannot starve the
  // desk. Windows are wide (30d) because trade coverage is low-volume.
  {
    name: "China duanju trade",
    url: "https://news.google.com/rss/search?q=(duanju+OR+%22micro+drama%22+OR+%22mini+drama%22)+(China+OR+Chinese+OR+Kuaishou+OR+Tencent+OR+iQiyi+OR+Douyin+OR+Mango+OR+%22Red+Note%22)+when:30d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 10,
  },
  {
    name: "Korea short drama",
    url: "https://news.google.com/rss/search?q=(Korea+OR+Korean+OR+K-drama+OR+Vigloo+OR+TopReels+OR+Spoon+OR+Naver+OR+Kakao)+(%22short+drama%22+OR+%22micro+drama%22+OR+%22vertical+drama%22+OR+%22shortform+drama%22+OR+%22short-form+drama%22)+when:30d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 10,
  },
  {
    name: "India vertical drama trade",
    url: "https://news.google.com/rss/search?q=(India+OR+Indian+OR+Telugu+OR+Hindi+OR+Tamil)+(%22vertical+video+series%22+OR+%22microdrama%22+OR+%22micro-drama%22+OR+%22Fatafat%22+OR+%22Flick+TV%22+OR+%22Bullet%22+OR+ShareChat+OR+%22Amazon+MX+Player%22)+when:30d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 10,
  },
  {
    name: "Micro-drama wire (Bing)",
    url: "https://www.bing.com/news/search?q=%22micro+drama%22+OR+%22microdrama%22+OR+duanju+OR+%22vertical+drama%22&format=RSS&cc=us&setmkt=en-us&setlang=en-us",
    kind: "news",
    limit: 10,
  },
  // Micro-drama leading ladies: the women fronting vertical series in the US,
  // India and China, with photo-led coverage for the Micro-Drama section.
  {
    name: "US vertical drama actresses",
    url: "https://news.google.com/rss/search?q=(ReelShort+OR+%22short+drama%22+OR+%22vertical+drama%22+OR+Holywater+OR+FlickReels)+(actress+OR+%22leading+lady%22+OR+%22female+lead%22+OR+star)+when:30d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 10,
  },
  {
    name: "India micro-drama heroines",
    url: "https://news.google.com/rss/search?q=(India+OR+Telugu+OR+Hindi+OR+Tamil)+(%22micro+drama%22+OR+%22short+drama%22+OR+%22vertical+series%22+OR+%22Flick+TV%22+OR+%22Kuku+TV%22+OR+ShareChat)+(actress+OR+heroine+OR+glamour)+when:30d&hl=en-IN&gl=IN&ceid=IN:en",
    kind: "news",
    limit: 10,
  },
  {
    name: "China duanju actresses",
    url: "https://news.google.com/rss/search?q=(duanju+OR+%22short+drama%22+OR+%22micro+drama%22+OR+DramaBox+OR+GoodShort+OR+ShortMax)+(China+OR+Chinese)+(actress+OR+star+OR+%22leading+lady%22)+when:30d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 10,
  },
  {
    name: "Micro-drama stars (Bing)",
    url: "https://www.bing.com/news/search?q=(%22short+drama%22+OR+%22micro+drama%22+OR+duanju+OR+ReelShort+OR+DramaBox)+(actress+OR+heroine+OR+glamour)&format=RSS&cc=us&setmkt=en-us&setlang=en-us",
    kind: "news",
    limit: 10,
  },

  {
    name: "Short drama apps (Bing)",
    url: "https://www.bing.com/news/search?q=ReelShort+OR+DramaBox+OR+GoodShort+OR+ShortMax+OR+%22Flick+TV%22+OR+Vigloo&format=RSS&cc=us&setmkt=en-us&setlang=en-us",
    kind: "news",
    limit: 10,
  },
  {
    name: "Asia short drama (Bing)",
    url: "https://www.bing.com/news/search?q=(China+OR+Korea+OR+India)+%22short+drama%22+series+app&format=RSS&cc=us&setmkt=en-us&setlang=en-us",
    kind: "news",
    limit: 10,
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

  // ── Master media-monitoring list: established cinema / OTT / micro-drama
  // desks across Telugu, Malayalam, Tamil, Hindi, Hollywood, Korean and
  // Chinese entertainment. Direct RSS where the publisher offers one, Google
  // News site: sweeps otherwise. Feeds rotate per run, so breadth here costs
  // nothing extra per collection cycle.

  // Tollywood — Telugu cinema, OTT and box office
  { name: "TeluguCinema.com", url: "https://www.telugucinema.com/feed", kind: "news", limit: 15 },
  {
    name: "CineJosh & Tollywood.net",
    url: "https://news.google.com/rss/search?q=(site:cinejosh.com+OR+site:tollywood.net+OR+site:aakashavaani.com)+when:7d&hl=en-IN&gl=IN&ceid=IN:en",
    kind: "news",
    limit: 6,
  },
  {
    name: "Idlebrain (search)",
    url: "https://news.google.com/rss/search?q=site:idlebrain.com+when:7d&hl=en-IN&gl=IN&ceid=IN:en",
    kind: "news",
    limit: 5,
  },
  {
    name: "TrackTollywood box office",
    url: "https://news.google.com/rss/search?q=site:tracktollywood.com+OR+site:andhraboxoffice.com+when:7d&hl=en-IN&gl=IN&ceid=IN:en",
    kind: "news",
    limit: 6,
  },
  {
    name: "IndiaGlitz Telugu",
    url: "https://news.google.com/rss/search?q=site:indiaglitz.com+telugu+when:3d&hl=en-IN&gl=IN&ceid=IN:en",
    kind: "news",
    limit: 6,
  },
  {
    name: "Sakshi & Eenadu cinema",
    url: "https://news.google.com/rss/search?q=(site:sakshi.com+OR+site:eenadu.net)+(cinema+OR+%E0%B0%B8%E0%B0%BF%E0%B0%A8%E0%B0%BF%E0%B0%AE%E0%B0%BE)+when:3d&hl=te&gl=IN&ceid=IN:te",
    kind: "news",
    limit: 6,
  },
  {
    name: "Cinema Express South",
    url: "https://news.google.com/rss/search?q=site:cinemaexpress.com+when:3d&hl=en-IN&gl=IN&ceid=IN:en",
    kind: "news",
    limit: 6,
  },

  // OTT / streaming specialists
  {
    name: "OTTplay releases",
    url: "https://news.google.com/rss/search?q=site:ottplay.com+(release+OR+streaming+OR+review+OR+%22OTT%22)+when:3d&hl=en-IN&gl=IN&ceid=IN:en",
    kind: "news",
    limit: 8,
  },
  {
    name: "Binged OTT releases",
    url: "https://news.google.com/rss/search?q=site:binged.com+when:3d&hl=en-IN&gl=IN&ceid=IN:en",
    kind: "news",
    limit: 6,
  },
  {
    name: "What's on Netflix",
    url: "https://www.whats-on-netflix.com/feed/",
    kind: "news",
    limit: 6,
  },
  {
    name: "Kerala TV OTT calendar",
    url: "https://news.google.com/rss/search?q=site:keralatv.in+(OTT+OR+release+OR+streaming)+when:7d&hl=en-IN&gl=IN&ceid=IN:en",
    kind: "news",
    limit: 6,
  },

  // Mollywood — Malayalam cinema
  {
    name: "Onmanorama entertainment",
    url: "https://news.google.com/rss/search?q=site:onmanorama.com+entertainment+when:3d&hl=en-IN&gl=IN&ceid=IN:en",
    kind: "news",
    limit: 6,
  },
  {
    name: "Mathrubhumi & The Cue movies",
    url: "https://news.google.com/rss/search?q=(site:mathrubhumi.com+OR+site:thecue.in)+(movie+OR+cinema+OR+film)+when:3d&hl=en-IN&gl=IN&ceid=IN:en",
    kind: "news",
    limit: 6,
  },

  // Bollywood / Hindi entertainment and box office
  
  {
    name: "Filmfare & Koimoi",
    url: "https://news.google.com/rss/search?q=(site:filmfare.com+OR+site:koimoi.com)+when:2d&hl=en-IN&gl=IN&ceid=IN:en",
    kind: "news",
    limit: 6,
  },
  {
    name: "Box office trackers",
    url: "https://news.google.com/rss/search?q=(site:sacnilk.com+OR+site:boxofficeindia.com)+(box+office+OR+collection)+when:3d&hl=en-IN&gl=IN&ceid=IN:en",
    kind: "news",
    limit: 6,
  },
  {
    name: "PeepingMoon & Bollywood Life",
    url: "https://news.google.com/rss/search?q=(site:peepingmoon.com+OR+site:bollywoodlife.com)+when:2d&hl=en-IN&gl=IN&ceid=IN:en",
    kind: "news",
    limit: 6,
  },

  // Hollywood / global trades
  { name: "Variety", url: "https://variety.com/feed/", kind: "news", limit: 15 },
  { name: "Deadline", url: "https://deadline.com/feed/", kind: "news", limit: 15 },
  {
    name: "The Hollywood Reporter",
    url: "https://www.hollywoodreporter.com/feed/",
    kind: "news",
    limit: 6,
  },
  { name: "IndieWire", url: "https://www.indiewire.com/feed/", kind: "news", limit: 12 },
  { name: "TheWrap", url: "https://www.thewrap.com/feed/", kind: "news", limit: 12 },
  {
    // Screen Daily and Collider block direct RSS reads, so both come through
    // Google News site: sweeps instead.
    name: "Screen Daily & Collider",
    url: "https://news.google.com/rss/search?q=(site:screendaily.com+OR+site:collider.com)+when:3d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 6,
  },

  // Korean — K-drama, K-film, OTT
  { name: "Soompi", url: "https://www.soompi.com/feed", kind: "news", limit: 15 },
  {
    name: "Korea entertainment dailies",
    url: "https://news.google.com/rss/search?q=(site:koreajoongangdaily.joins.com+OR+site:koreaherald.com+OR+site:koreatimes.co.kr)+(drama+OR+film+OR+entertainment)+when:3d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 6,
  },
  {
    name: "KoBiz Korean film",
    url: "https://news.google.com/rss/search?q=(site:koreanfilm.or.kr+OR+%22Korean+Film+Council%22)+(box+office+OR+film+OR+industry)+when:14d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 5,
  },
  {
    name: "K-drama trackers",
    url: "https://news.google.com/rss/search?q=(site:mydramalist.com+OR+site:hancinema.net+OR+site:dramabeans.com)+when:7d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 6,
  },

  // Chinese — C-drama, film, micro-drama industry
  {
    name: "China entertainment (English)",
    url: "https://news.google.com/rss/search?q=(site:chinadaily.com.cn+OR+site:sixthtone.com+OR+site:scmp.com+OR+site:chinafilminsider.com)+(film+OR+drama+OR+entertainment+OR+%22short+drama%22)+when:7d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 8,
  },
  {
    name: "China box office & platforms",
    url: "https://news.google.com/rss/search?q=(Maoyan+OR+Douban+OR+iQiyi+OR+Youku+OR+%22Mango+TV%22+OR+Tencent+Video+OR+Bilibili)+(drama+OR+film+OR+box+office+OR+series)+when:7d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 8,
  },
  {
    name: "Hongguo & Douyin short drama",
    url: "https://news.google.com/rss/search?q=(Hongguo+OR+Douyin+OR+Kuaishou+OR+%22WeChat+Channels%22)+(%22short+drama%22+OR+duanju+OR+%22micro+drama%22)+when:30d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 8,
  },

  // Global micro-drama / vertical-series apps and their trade coverage
  {
    name: "Vertical drama apps wire",
    url: "https://news.google.com/rss/search?q=(ReelShort+OR+DramaBox+OR+GoodShort+OR+ShortMax+OR+FlexTV+OR+NetShort+OR+MoboReels+OR+TopShort+OR+DreameShort+OR+Melolo+OR+%22My+Drama%22)+when:30d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 10,
  },
  {
    name: "Micro-drama business desks",
    url: "https://news.google.com/rss/search?q=(site:tubefilter.com+OR+site:digiday.com+OR+site:variety.com+OR+site:deadline.com+OR+site:hollywoodreporter.com+OR+site:sensortower.com)+(%22short+drama%22+OR+%22micro+drama%22+OR+%22microdrama%22+OR+duanju+OR+%22vertical+series%22)+when:30d&hl=en-US&gl=US&ceid=US:en",
    kind: "news",
    limit: 10,
  },
  {
    name: "India micro-drama trade desks",
    url: "https://news.google.com/rss/search?q=(site:medianama.com+OR+site:exchange4media.com+OR+site:afaqs.com+OR+site:mediabrief.com+OR+site:indiantelevision.com)+(%22short+drama%22+OR+%22micro+drama%22+OR+%22vertical+video%22+OR+OTT)+when:30d&hl=en-IN&gl=IN&ceid=IN:en",
    kind: "news",
    limit: 8,
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
  {
    name: "Free Press Entertainment",
    url: "https://news.google.com/rss/search?q=site:freepressjournal.in+(movie+OR+cinema+OR+film+OR+OTT+OR+Bollywood)+when:3d&hl=en-IN&gl=IN&ceid=IN:en",
    kind: "news",
    limit: 12,
    match: /movie|cinema|film|ott|bollywood|actor|actress|trailer|teaser|review|box office/i,
  },
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

async function fetchPublisher(
  feed: (typeof PUBLISHER_FEEDS)[number],
  opts?: { galleryMode?: boolean },
): Promise<RawItem[]> {
  const stat = publisherDiag(feed.name);
  stat.requests += 1;
  const parsed = await fetchFeed(feed.url, { label: feed.name });
  if (!parsed?.length) {
    const errors = formatCountMap(lastDiag.googleNews.bySource[feed.name]?.errors ?? {});
    if (errors) stat.error = errors;
    return [];
  }
  stat.returned += parsed.length;
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
  stat.kept += merged.length;
  stat.withImage += merged.filter((item) => !!item.image).length;
  for (const item of merged) {
    const gallery = !!opts?.galleryMode && isStarGallery(item.title, null, item.link);
    const microDrama = !gallery && isMicroDrama(item.title, null, item.link);
    const cinema = !gallery && !microDrama && isCinema(item.title, null, item.link);
    if (gallery) stat.gallery += 1;
    else if (microDrama) stat.microDrama += 1;
    else if (cinema) stat.cinema += 1;
    else stat.other += 1;
  }
  lastDiag.kept += merged.length;
  return merged;
}

function isGalleryPublisher(feed: (typeof PUBLISHER_FEEDS)[number]): boolean {
  return GALLERY_FEED_NAMES.includes(feed.name);
}

function isCinemaPublisher(feed: (typeof PUBLISHER_FEEDS)[number]): boolean {
  if (isGalleryPublisher(feed)) return false;
  const hay = `${feed.name} ${feed.url}`;
  return /cinema|movie|film|ott|stream|bollywood|tollywood|kollywood|mollywood|sandalwood|hollywood|soompi|korea|drama|box office|telugu360|mirchi9|m9\.news|123telugu|gulte|greatandhra|cinejosh|idlebrain|tracktollywood|indiaglitz|filmfare|koimoi|variety|deadline|hollywoodreporter|indiewire|thewrap/i.test(
    hay,
  );
}

function isIndiaPublisher(feed: (typeof PUBLISHER_FEEDS)[number]): boolean {
  if (isCinemaPublisher(feed) || isGalleryPublisher(feed)) return false;
  const hay = `${feed.name} ${feed.url}`;
  return /new india abroad|india west|american bazaar|times of india|ndtv india|the hindu|deccan chronicle|new indian express|telangana|andhra|amaravati|uscis|murthy|immigration|consulate|telugu times/i.test(
    hay,
  );
}

function deskCategoryForItem(
  item: RawItem,
  fallback: typeof CINEMA_SLUG | typeof MICRO_DRAMA_SLUG,
): { category: typeof CINEMA_SLUG | typeof MICRO_DRAMA_SLUG; reason: ClassifyReason } {
  const { category, reason } = classifyDeskItem({
    title: item.title,
    summary: item.detail,
    url: item.link,
    sourceName: item.source,
    unresolved: item.unresolved,
    sweep: fallback as DeskCategory,
  });
  return {
    category: (category === "news" ? fallback : category) as
      | typeof CINEMA_SLUG
      | typeof MICRO_DRAMA_SLUG,
    reason,
  };
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
    label: "City of San Leandro",
    urls: ["https://www.sanleandro.org/RSSFeed.aspx?ModID=76&CID=All-0"],
  },
  // Redwood City, Fremont and most Peninsula/South Bay city sites block
  // datacenter traffic on their CivicPlus RSS endpoints (HTTP 403), so their
  // local calendar and civic coverage comes through the town news feed instead.
  {
    citySlug: BAY_AREA.slug,
    label: "Redwood City",
    urls: ["https://patch.com/feeds/rss/california/redwoodcity-woodside"],
  },
  {
    citySlug: BAY_AREA.slug,
    label: "San Mateo",
    urls: ["https://patch.com/feeds/rss/california/sanmateo"],
  },
  { citySlug: "fremont", label: "Fremont", urls: ["https://patch.com/feeds/rss/california/fremont"] },
  {
    citySlug: "milpitas",
    label: "Milpitas",
    urls: ["https://patch.com/feeds/rss/california/milpitas"],
  },
  { citySlug: "dublin", label: "Dublin", urls: ["https://patch.com/feeds/rss/california/dublin"] },
  {
    citySlug: "pleasanton",
    label: "Pleasanton",
    urls: ["https://patch.com/feeds/rss/california/pleasanton"],
  },
  {
    citySlug: "livermore",
    label: "Livermore",
    urls: ["https://patch.com/feeds/rss/california/livermore"],
  },
  {
    citySlug: "cupertino",
    label: "Cupertino",
    urls: ["https://patch.com/feeds/rss/california/cupertino"],
  },
  {
    citySlug: "mountain-view",
    label: "Mountain View",
    urls: ["https://patch.com/feeds/rss/california/mountainview"],
  },
  {
    citySlug: "palo-alto",
    label: "Palo Alto",
    urls: ["https://patch.com/feeds/rss/california/paloalto"],
  },
  {
    citySlug: "san-ramon",
    label: "San Ramon",
    urls: ["https://patch.com/feeds/rss/california/sanramon"],
  },
  {
    citySlug: "union-city",
    label: "Union City",
    urls: ["https://patch.com/feeds/rss/california/unioncity"],
  },
  { citySlug: "gilroy", label: "Gilroy", urls: ["https://patch.com/feeds/rss/california/gilroy"] },
];

/** Cities whose guides we only reach through a news search. */
const GUIDE_SEARCH_CITIES = [
  ...CITIES.map((c) => ({ citySlug: c.slug, name: c.en })),
  { citySlug: BAY_AREA.slug, name: "Redwood City" },
  { citySlug: BAY_AREA.slug, name: "San Mateo" },
  { citySlug: BAY_AREA.slug, name: "Morgan Hill" },
];

const GUIDE_WORDS =
  /activity guide|recreation|rec guide|parks and rec|class(?:es)?|camp|program|programme|registration|enroll|swim|library|storytime|summer|fall|winter|spring|senior center|community center|workshop|clinic|league|event|festival|fair|farmers market|concert|parade|celebration|movie night|street party|holiday|volunteer|open house|tour|run|walk|market/i;


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
      const parsed = await fetchFeed(url, { label: entry.label });
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
  const q = `"${city.name}" California (events OR festival OR "farmers market" OR "activity guide" OR "parks and recreation" OR "community center" OR concert OR parade OR camps OR classes)`;
  // Google News carries these municipal round-ups reliably; Bing frequently
  // answers with an empty channel, so it is only the fallback now.
  let parsed = await fetchFeed(
    `https://news.google.com/rss/search?q=${encodeURIComponent(q)}+when:21d&hl=en-US&gl=US&ceid=US:en`,
    { label: `guide:${city.citySlug}:google` },
  );
  if (!parsed?.length) {
    parsed = await fetchFeed(
      `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=RSS&cc=us&setmkt=en-us&setlang=en-us`,
      { label: `guide:${city.citySlug}:bing` },
    );
  }
  if (!parsed?.length) return [];
  lastDiag.fetched += 1;
  lastDiag.raw += parsed.length;
  const cityWords = normalize(city.name);
  const seen = new Set<string>();
  const merged: RawItem[] = [];
  for (const item of parsed) {
    // The city name often sits in the outlet name or the blurb rather than the
    // headline, so match across everything we have before dropping an item.
    const hay = normalize(`${item.title} ${item.source} ${item.detail ?? ""}`);
    const k = normalize(item.title);
    if (!k || seen.has(k)) continue;
    if (!hay.includes(cityWords) || !GUIDE_WORDS.test(hay)) continue;
    if (GUIDE_JUNK.test(item.title)) continue;
    if (!inGuideWindow(item.published)) continue;
    seen.add(k);
    merged.push(item);
    if (merged.length >= 6) break;
  }
  await addImages(merged);
  lastDiag.kept += merged.length;
  return merged;
}

/**
 * NRI-interest community events for each of the 16 cities: Telugu / Indian
 * cultural programmes, temple festivals, association gatherings and desi
 * markets. The municipal guide search only surfaces city-run recreation, so
 * this pass is what keeps the Events page stocked with diaspora listings.
 */
const NRI_EVENT_WORDS =
  /telugu|indian|india|hindu|temple|mandir|desi|south asian|bollywood|tollywood|carnatic|kuchipudi|classical|ugadi|diwali|deepavali|sankranti|bathukamma|bonalu|navratri|garba|holi|onam|pongal|vinayaka|ganesh|tana|nats|ata|association|cultural/i;

async function fetchNriEventSearch(city: {
  citySlug: string;
  name: string;
}): Promise<RawItem[]> {
  const q = `"${city.name}" California (Telugu OR Indian OR Hindu OR "South Asian" OR desi) (event OR festival OR concert OR mela OR "cultural program" OR temple OR Diwali OR Ugadi OR Sankranti OR Navratri OR Garba OR Holi OR fundraiser OR "community meet")`;
  let parsed = await fetchFeed(
    `https://news.google.com/rss/search?q=${encodeURIComponent(q)}+when:30d&hl=en-US&gl=US&ceid=US:en`,
    { label: `nri-events:${city.citySlug}:google` },
  );
  if (!parsed?.length) {
    parsed = await fetchFeed(
      `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=RSS&cc=us&setmkt=en-us&setlang=en-us`,
      { label: `nri-events:${city.citySlug}:bing` },
    );
  }
  if (!parsed?.length) return [];
  lastDiag.fetched += 1;
  lastDiag.raw += parsed.length;
  const cityWords = normalize(city.name);
  const seen = new Set<string>();
  const merged: RawItem[] = [];
  for (const item of parsed) {
    const hay = normalize(`${item.title} ${item.source} ${item.detail ?? ""}`);
    const k = normalize(item.title);
    if (!k || seen.has(k)) continue;
    // Must be about this city AND read as a diaspora community happening.
    if (!hay.includes(cityWords)) continue;
    if (!NRI_EVENT_WORDS.test(hay)) continue;
    if (!EVENT_WORDS.test(hay) && !GUIDE_WORDS.test(hay)) continue;
    if (GUIDE_JUNK.test(item.title)) continue;
    if (!inGuideWindow(item.published)) continue;
    seen.add(k);
    merged.push(item);
    if (merged.length >= 6) break;
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

/** Calls per headline above this means the batcher is degrading toward singles. */
export const CALLS_PER_HEADLINE_LIMIT = 0.35;

/**
 * Gemini summary calls made by the current run. One call used to be made per
 * city / feed group, which meant dozens of tiny requests per pass; groups are
 * now batched and already-stored headlines are never summarized at all, so this
 * counter is the before/after measure of that saving. Logged at the end of
 * every run as `[collect] gemini summary calls …`.
 */
export const aiUsage = { calls: 0, itemsSummarized: 0, itemsSkipped: 0, batches: 0 };

/**
 * Full batching metrics for the run: calls, per-item failovers, malformed
 * batches and throttling. Persisted by `recordSummaryRun` and shown on
 * /admin/health.
 */
export let aiBatchMetrics = newBatchMetrics();

type SummaryGroup = { key: string; city: City; items: RawItem[] };

function fallbackSummary(item: RawItem) {
  return `Reported by ${item.source}. Verify details and add the Telugu translation before publishing.`;
}

/**
 * Summaries for a batch of feed groups.
 *
 * Groups are packed into as few model calls as possible (up to
 * SUMMARY_GROUP_CAP desks and SUMMARY_ITEM_CAP headlines each) and anything
 * whose dedupe key is already stored or already rejected is never sent — a
 * batch with nothing new makes no call at all. Replies are validated against
 * the exact ids that were sent; anything missing or malformed is re-summarized
 * one item at a time instead of being silently dropped.
 */
async function summarizeGroups(
  groups: SummaryGroup[],
  apiKey: string | undefined,
  known?: Set<string>,
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  for (const g of groups) result.set(g.key, g.items.map(fallbackSummary));
  if (!apiKey) {
    if (groups.some((g) => g.items.length)) lastAiError = "LOVABLE_API_KEY missing at runtime";
    return result;
  }

  // Anything already in the store (or already rejected) is dropped downstream,
  // so it never earns a summary call.
  type Group = { key: string; desk: string; index: number };
  const entries: (SummaryEntry<Group> & { groupKey: string; itemIndex: number; link: string })[] = [];
  for (const g of groups) {
    g.items.forEach((item, index) => {
      if (known && storyIdentityKeys(item.title, item.link).some((key) => known.has(key))) {
        aiUsage.itemsSkipped += 1;
        return;
      }
      // A usable publisher description costs nothing: no model call at all.
      const fromFeed = descriptionSummary(item.detail, item.title);
      if (fromFeed) {
        result.get(g.key)![index] = fromFeed;
        aiUsage.itemsSkipped += 1;
        return;
      }
      entries.push({
        id: `${g.key}#${index}`,
        group: { key: g.key, desk: g.city.en, index },
        text: `${item.title} (${item.source})`,
        source: item.source,
        groupKey: g.key,
        itemIndex: index,
        link: item.link,
      });
    });
  }
  if (!entries.length) return result;

  // Dedupe runs before the queue, not after: overlapping Telugu / OTT feeds
  // carry the same story under different links, and summarizing each copy was
  // pure waste. Copies reuse the summary of the item that was actually sent.
  const { queue, aliases, dropped } = dedupeEntries(entries, (e) =>
    storyIdentityKeys(e.text.replace(/\s*\([^)]*\)\s*$/, ""), e.link),
  );
  aiUsage.itemsSkipped += dropped;

  if (pastModel()) {
    lastDiag.notes.push(`summary: run budget exhausted before the model phase; ${queue.length} item(s) use feed/fallback text`);
    return result;
  }
  const gateway = createLovableAiGatewayProvider(apiKey);
  const { summaries, errors } = await runSummaryBatches<Group>(
    queue,
    async (prompt) => {
      // "budget exhausted" is deliberately not a retryable message: the batch
      // fails once, its items keep their fallback text, and the run moves on.
      if (pastModel()) throw new Error("run budget exhausted");
      const { text } = await generateText({
        model: gateway("google/gemini-3.1-flash-lite"),
        abortSignal: AbortSignal.timeout(Math.max(5_000, Math.min(25_000, modelDeadline - Date.now()))),
        prompt,
      });
      return text;
    },
    { metrics: aiBatchMetrics, concurrency: SUMMARY_CONCURRENCY },
  );

  aiUsage.calls = aiBatchMetrics.calls;
  aiUsage.batches = aiBatchMetrics.batches;
  aiUsage.itemsSummarized = aiBatchMetrics.itemsSummarized;
  lastAiError = summaries.size ? null : (errors[0] ?? lastAiError);

  for (const e of entries) {
    const summary = summaries.get(e.id) ?? summaries.get(aliases.get(e.id) ?? "");
    if (!summary) continue;
    const list = result.get(e.groupKey);
    if (list) list[e.itemIndex] = summary;
  }

  return result;
}

/**
 * Dedupe keys already stored or already rejected. Shared with the route via
 * known-keys.server so the tables are read once per run (and cached briefly).
 */
async function loadKnownKeys(): Promise<Set<string>> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadKnownKeys: load } = await import("./known-keys.server");
    const known = await load(supabaseAdmin as never);
    runKnown = known.keys;
    return known.keys;
  } catch (e) {
    console.error("known-key preload failed", e);
    runKnown = null;
    return new Set();
  }
}
/** Collect fresh items for every city. Returns rows ready for a dedupe-safe upsert. */
/**
 * Full news pass, read in rotating slices inside a hard time budget.
 *
 * Reading every city, guide, topic group and publisher in one request took
 * minutes, so the scheduled call was always cut short and nothing reached the
 * publishing stage — which is how the sections went stale. Each run now starts
 * at the next offset and stops when the budget runs out, so every desk is still
 * covered across a few runs and every run finishes.
 */
export async function collectAll(
  apiKey: string | undefined,
  opts?: { deadlineMs?: number; slice?: number },
): Promise<CollectedItem[]> {
  const today = new Date().toISOString().slice(0, 10);
  const rows: CollectedItem[] = [];
  const started = Date.now();
  const total = Math.min(Math.max(opts?.deadlineMs ?? 45_000, 5_000), 120_000);
  const deadline = started + total;
  const inBudget = () => Date.now() < deadline;
  fetchDeadline = deadline;
  modelDeadline = deadline + MODEL_PHASE_MS;
  /**
   * Each pass gets a reserved share of the run. The Bay Area city pass used to
   * consume the whole budget, so the India and Cinema/OTT feeds (which live in
   * the topic and publisher passes further down) never ran and those desks went
   * stale for days. Capping each pass keeps every desk collecting on every run.
   */
  const within = (share: number) => Date.now() < started + total * share;
  const slice = opts?.slice ?? Math.floor(Date.now() / (20 * 60 * 1000));
  /** Rotates a list so successive runs start where the last one stopped. */
  const rotate = <T,>(list: T[], step: number): T[] => {
    if (!list.length) return list;
    const start = ((slice * step) % list.length + list.length) % list.length;
    return [...list.slice(start), ...list.slice(0, start)];
  };
  resetRunDiagnostics();
  resetAiUsage();
  const knownKeys = await loadKnownKeys();

  /**
   * One pooled summary queue for the whole run. Each pass used to summarize its
   * own fetch immediately, so every pass (and every newly added source group)
   * left a small remainder call behind — that is what pushed calls-per-headline
   * from ~0.28 to 0.50. Passes now only queue their groups; a single batched
   * summarization runs at the end and patches the rows in place.
   */
  const summaryPool: SummaryGroup[] = [];
  const queueSummaries = (groups: { key: string; city: City; items: RawItem[] }[]) => {
    for (const g of groups) summaryPool.push({ key: g.key, city: g.city, items: g.items });
  };


  const cityList = rotate(CITIES, 4);
  for (let b = 0; b < cityList.length && within(0.35); b += 4) {
    const batch = cityList.slice(b, b + 4);
    // Fetch the whole batch first, then summarize it in as few calls as possible.
    const fetched = await Promise.all(
      batch.map(async (city) => ({ key: `city:${city.slug}`, city, items: await fetchCity(city) })),
    );
    queueSummaries(fetched);
    const collected = await Promise.all(
      fetched.map(async ({ key, city, items }) => {
        const summaries: string[] = [];
        return items.map((it, i) => {
          const kind = classify(it.title);
          const dedupe = itemDedupeKey(city.slug, it.title, it.link);
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

  // City activity guides, municipal recreation calendars, and the NRI-interest
  // community events pass for every one of the 16 cities.
  const guideEntries = rotate(
    [
      ...CITY_GUIDE_FEEDS.map((e) => ({ kind: "feed" as const, entry: e })),
      ...GUIDE_SEARCH_CITIES.map((c) => ({ kind: "search" as const, entry: c })),
      ...GUIDE_SEARCH_CITIES.map((c) => ({ kind: "nri" as const, entry: c })),
    ],
    5,
  );
  for (let b = 0; b < guideEntries.length && within(0.55); b += 5) {
    const guideFetched = await Promise.all(
      guideEntries.slice(b, b + 5).map(async (g, gi) => {
        const items =
          g.kind === "feed"
            ? await fetchCityGuide(g.entry as { citySlug: string; label: string; urls: string[] })
            : g.kind === "nri"
              ? await fetchNriEventSearch(g.entry as { citySlug: string; name: string })
              : await fetchGuideSearch(g.entry as { citySlug: string; name: string });
        const slug = g.entry.citySlug;
        return { key: `guide:${g.kind}:${slug}:${gi}`, city: cityBySlug(slug) ?? BAY_AREA, items, g, slug };
      }),
    );
    queueSummaries(guideFetched);
    const guideRows = await Promise.all(
      guideFetched.map(async ({ key, items, g, slug }) => {
        const summaries: string[] = [];
        return items.map((it, i) => {
          // The NRI pass only keeps community happenings, so those always file
          // as events (a temple festival still files as temple).
          const kind =
            g.kind === "nri" ? (TEMPLE_WORDS.test(it.title) ? "temple" : "event") : guideKind(it);
          const dedupe = itemDedupeKey(slug, it.title, it.link);
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
  const topicFetched = await Promise.all(
    (within(0.72) ? TOPIC_GROUPS.filter((group) => topicDesk(group) === "other") : []).map(async (group, gi) => ({
      key: `topic:${gi}`,
      city: BAY_AREA,
      items: await fetchTopics(group),
      group,
    })),
  );
  queueSummaries(topicFetched);
  const topicRows = await Promise.all(
    topicFetched.map(async ({ key, items, group }) => {
      const summaries: string[] = [];
      return items.map((it, i) => {
        const dedupe = itemDedupeKey(BAY_AREA.slug, it.title, it.link);
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
  const rotatedPublishers = rotate(PUBLISHER_FEEDS, 8);
  // Cinema / OTT / micro-drama sources run first. The prior all-source rotation
  // often spent its budget before reaching the newly added media desks, leaving
  // the public Cinema page populated by only older broad-source items.
  const publisherList = rotatedPublishers.filter(
    (feed) => !isCinemaPublisher(feed) && !isGalleryPublisher(feed) && !isIndiaPublisher(feed),
  );
  for (let b = 0; b < publisherList.length && within(0.92); b += 8) {
  lastDiag.publishers.selected.push(...publisherList.slice(b, b + 8).map((feed) => feed.name));
  const publisherFetched = await Promise.all(
    publisherList.slice(b, b + 8).map(async (feed, fi) => ({
      key: `pub:${b}:${fi}`,
      city: BAY_AREA,
      items: await fetchPublisher(feed),
      feed,
    })),
  );
  queueSummaries(publisherFetched);
  const publisherRows = await Promise.all(
    publisherFetched.map(async ({ key, items, feed }) => {
      const summaries: string[] = [];
      return items.map((it, i) => {
        const dedupe = itemDedupeKey(BAY_AREA.slug, it.title, it.link);
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
      const dedupe = itemDedupeKey(BAY_AREA.slug, p.title, p.link);
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
    const temples = inBudget() ? await fetchAllTemples() : [];
    for (const t of temples) {
      const slug =
        CITIES.find((c) => c.en.toLowerCase() === t.source.city.toLowerCase())?.slug ??
        BAY_AREA.slug;
      for (const a of t.announcements.slice(0, 4)) {
        const dedupe = itemDedupeKey(slug, `${t.source.name} ${a.title}`, a.url || t.source.site);
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



  // One batched summarization for every pass in this run. Rows carry an empty
  // summary until this point; they are matched back by dedupe key, which is how
  // each pass already identifies its own items.
  if (summaryPool.length) {
    const pooledSummaries = await summarizeGroups(summaryPool, apiKey, knownKeys);
    const byKey = new Map<string, string>();
    for (const g of summaryPool) {
      const list = pooledSummaries.get(g.key) ?? [];
      g.items.forEach((item, index) => {
        const summary = list[index];
        const key = itemDedupeKey(g.city.slug, item.title, item.link);
        if (summary && !byKey.has(key)) byKey.set(key, summary);
      });
    }
    for (const row of rows) {
      if (row.summary) continue;
      const summary = byKey.get(row.dedupe_key);
      if (!summary) continue;
      row.summary = summary;
      (row.payload as { summary?: string }).summary = summary;
    }
  }

  syncSummaryDiag();
  lastDiag.notes.push(googleNewsSummaryNote());

  // Temple coverage stays strictly religious and from reliable/temple sources.
  const templeSafe = rows.filter(
    (r) =>
      r.kind !== "temple" ||
      isTempleNewsClean({ title: r.title, summary: r.summary, sourceUrl: r.source_url }),
  );
  // Before/after measure of the summary batching: one line per run.
  const perHeadline = callsPerHeadline(aiBatchMetrics);
  const note =
    `gemini summary calls: ${aiUsage.calls} (calls_per_headline ${perHeadline}, batches ${aiUsage.batches}, ` +
    `avg batch ${averageBatchSize(aiBatchMetrics)}, per-item failovers ${aiBatchMetrics.fallbackCalls}, ` +
    `items summarized ${aiUsage.itemsSummarized}, already-stored items skipped ${aiUsage.itemsSkipped}, ` +
    `truncation ${(truncationRate(aiBatchMetrics) * 100).toFixed(1)}%, retries ${aiBatchMetrics.retry.retries})`;
  console.log(`[collect] ${note}`);
  lastDiag.notes.push(note);
  // Records the run and alerts when call volume or truncation regresses.
  // Guard: batching is only working while this ratio stays low. Above the
  // threshold, name the publishers whose items became single-item calls.
  if (perHeadline > CALLS_PER_HEADLINE_LIMIT && aiBatchMetrics.itemsSummarized > 0) {
    const worst = topSingleCallSources(aiBatchMetrics, 5)
      .map((s) => `${s.source} (${s.calls})`)
      .join(", ");
    const warn =
      `summary batching warning: calls_per_headline ${perHeadline} exceeded ${CALLS_PER_HEADLINE_LIMIT} ` +
      `(avg batch ${averageBatchSize(aiBatchMetrics)})` +
      (worst ? ` — most single-item calls: ${worst}` : "");
    console.warn(`[collect] ${warn}`);
    lastDiag.notes.push(warn);
  }
  const { warnings } = await recordSummaryRun(aiBatchMetrics, aiUsage.itemsSkipped, "collect");
  for (const w of warnings) lastDiag.notes.push(`summary warning: ${w}`);
  return dedupeCollected(templeSafe);
}


/** Dedicated Cinema/OTT run: topic sweep + direct media publishers with its own budget. */
/** Cinema publishers read per run; the rest wait for the next rotation slot. */
const DESK_PUBLISHERS_PER_RUN = 16;

export async function collectDesk(
  desk: "cinema",
  apiKey: string | undefined,
  opts?: { deadlineMs?: number; slice?: number; sliceSize?: number },
): Promise<CollectedItem[]> {
  const today = new Date().toISOString().slice(0, 10);
  resetRunDiagnostics();
  resetAiUsage();
  const deadline = Date.now() + Math.min(Math.max(opts?.deadlineMs ?? 55_000, 10_000), 120_000);
  const inBudget = () => Date.now() < deadline;
  fetchDeadline = deadline;
  modelDeadline = deadline + MODEL_PHASE_MS;
  const knownKeys = await loadKnownKeys();
  const summaryPool: SummaryGroup[] = [];
  const rows: CollectedItem[] = [];

  // Rotation: every run reads one topic group and one slice of the publisher
  // list, so a 30-minute cron covers every source within ~90 minutes while
  // each run stays well inside its budget. Direct RSS feeds go first — they
  // are fast and never throttled — and Google search feeds fill the tail.
  const slice = opts?.slice ?? Math.floor(Date.now() / (30 * 60 * 1000));
  const allTopicGroups = TOPIC_GROUPS.filter((group) => {
    const kind = topicDesk(group);
    return kind === "cinema" || kind === "micro-drama";
  });
  const topicGroups = allTopicGroups.length
    ? [allTopicGroups[slice % allTopicGroups.length]!]
    : [];
  const topicFetched = await Promise.all(
    topicGroups.map(async (group, index) => ({
      key: `cinema-topic:${index}`,
      city: BAY_AREA,
      items: inBudget()
        ? await fetchTopics(group, { limit: DESK_TOPIC_MAX[topicDesk(group)] ?? TOPIC_MAX })
        : [],
      group,
    })),
  );
  summaryPool.push(...topicFetched.map(({ key, city, items }) => ({ key, city, items })));

  const cinemaFeeds = PUBLISHER_FEEDS.filter(isCinemaPublisher).map((feed) => ({
    ...feed,
    limit: Math.max(feed.limit ?? 6, isGoogleNewsFeed(feed.url) ? 10 : 12),
  }));
  const sliceSize = opts?.sliceSize ?? DESK_PUBLISHERS_PER_RUN;
  const start = (slice * sliceSize) % Math.max(1, cinemaFeeds.length);
  const rotated = [...cinemaFeeds.slice(start), ...cinemaFeeds.slice(0, start)].slice(0, sliceSize);
  const publisherFeeds = [
    ...rotated.filter((f) => !isGoogleNewsFeed(f.url) && !/bing\.com/.test(f.url)),
    ...rotated.filter((f) => /bing\.com/.test(f.url)),
    ...rotated.filter((f) => isGoogleNewsFeed(f.url)),
  ];
  for (let b = 0; b < publisherFeeds.length && inBudget(); b += 8) {
    const slice = publisherFeeds.slice(b, b + 8);
    lastDiag.publishers.selected.push(...slice.map((feed) => feed.name));
    const fetched = await Promise.all(
      slice.map(async (feed, index) => ({
        key: `cinema-pub:${b}:${index}`,
        city: BAY_AREA,
        items: await fetchPublisher(feed),
        feed,
      })),
    );
    summaryPool.push(...fetched.map(({ key, city, items }) => ({ key, city, items })));
  }

  // Resolution runs before classification so the host map sees real publishers.
  await resolveWrappedLinks(summaryPool.flatMap((g) => g.items));

  const summaries = await summarizeGroups(summaryPool, apiKey, knownKeys);
  const append = (key: string, items: RawItem[], sourceName?: string, fallbackCategory: typeof CINEMA_SLUG | typeof MICRO_DRAMA_SLUG = CINEMA_SLUG) => {
    const list = summaries.get(key) ?? [];
    items.forEach((it, i) => {
      const { category, reason } = deskCategoryForItem(it, fallbackCategory);
      const summary = list[i] ?? fallbackSummary(it);
      const dedupe = itemDedupeKey(BAY_AREA.slug, it.title, it.link);
      const image = it.image ?? DESK_PLACEHOLDER_IMAGE;
      const source = it.source || sourceName || "Cinema/OTT";
      recordClassified(source, category, reason);
      rows.push({
        dedupe_key: dedupe,
        item_id: dedupe,
        digest_date: (it.published ?? `${today}T00:00:00Z`).slice(0, 10),
        kind: "news",
        city_slug: BAY_AREA.slug,
        title: it.title,
        summary,
        source,
        source_url: it.link,
        published_at: it.published,
        origin: "feed",
        payload: {
          id: dedupe,
          kind: "news",
          citySlug: BAY_AREA.slug,
          title: it.title,
          summary,
          source,
          sourceUrl: it.link,
          image,
          category,
          resolved_category: category,
          desk,
          collectedAt: today,
        },
      });
    });
  };

  for (const group of topicFetched) append(group.key, group.items, undefined, topicDesk(group.group) === "micro-drama" ? MICRO_DRAMA_SLUG : CINEMA_SLUG);
  for (const group of summaryPool.filter((g) => g.key.startsWith("cinema-pub:"))) {
    append(group.key, group.items);
  }

  syncSummaryDiag();
  lastDiag.notes.push(googleNewsSummaryNote());
  lastDiag.notes.push(
    `classification reasons: ${formatCountMap(lastDiag.classification.byReason) || "none"}; unresolved google links ${lastDiag.classification.unresolvedLinks}`,
  );
  const perHeadline = callsPerHeadline(aiBatchMetrics);
  lastDiag.notes.push(
    `gemini summary calls: ${aiUsage.calls} (calls_per_headline ${perHeadline}, batches ${aiUsage.batches}, avg batch ${averageBatchSize(aiBatchMetrics)}, per-item failovers ${aiBatchMetrics.fallbackCalls}, items summarized ${aiUsage.itemsSummarized}, already-stored items skipped ${aiUsage.itemsSkipped})`,
  );
  const { warnings } = await recordSummaryRun(aiBatchMetrics, aiUsage.itemsSkipped, `collect:${desk}`);
  for (const warning of warnings) lastDiag.notes.push(`summary warning: ${warning}`);
  return dedupeCollected(rows);
}


/** Picture desks that feed the Gallery grid. */
const GALLERY_FEED_NAMES = [
  "Fashion women (Google)",
  "Female models (Google)",
  "Beauty portraits (Google)",
  "Female celebrities (Google)",
  "Actress photos (Google)",
  "Modeling photography (Google)",
  "Editorial portraits (Google)",
  "Women lifestyle (Google)",
  "Red carpet women (Google)",
  "Female influencers (Google)",
  "Fashion photography (Bing)",
  "Beauty photography (Bing)",
  "Portrait photography woman (Bing)",
  "Women fashion week (Bing)",
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
  "Kollywood heroines",
  "Mollywood heroines",
  "Sandalwood heroines",
  "South stars glamour",
  "K-drama actresses",
  "K-pop female idols",
  "Korean red carpets",
  "K-entertainment pictorials (Bing)",
  "Hollywood premieres & galas",
  "Hollywood photoshoot galleries",
  "Hollywood press drops (Bing)",
  "India pageant & fashion",
  "Tollywood heroine names",
  "Kollywood heroine names",
  "Mollywood heroine names",
  "Sandalwood heroine names",
  "South glamour girls search",
  "South heroine photoshoot search",
  "OTT & streaming actresses",
  "Micro-drama actresses gallery",
  "TV & anchor glamour",
  "Social media creators glamour",
  "Models & fashion shoots",
  "Dancers & performers glamour",
  "Glamour Tollywood (Google)",
  "Glamour Tollywood (Bing)",
  "Glamour Telugu heroines (Bing)",
  "US vertical drama actresses",
  "India micro-drama heroines",
  "China duanju actresses",
  "Micro-drama stars (Bing)",


  
  "Instagram photo dumps",
  "Social media buzz",
  "Star photo stories",
  "Saree & ethnic looks",
  "Heroine photoshoot wire",
  "South heroine pics daily",
  "Bollywood heroine pics daily",
  "TOI entertainment photos",
  "Telugu heroine photos (Telugu)",
  "Heroine photo galleries (wide)",
  "Ragalahari galleries",
  "TeluguStop photos",
  "Pinkvilla photos",
  "Heroine latest looks",
  "తెలుగు హీరోయిన్లు",
  "eTimes photos",

];

/**
 * Gallery-only pass: re-reads the star / photo desks with a wider limit so the
 * Cinema Gallery keeps filling up between the full collection runs.
 *
 * `slice` reads only part of the desk list. Reading all ~40 photo desks in one
 * request means hundreds of article-page reads for artwork, which the serverless
 * runtime cuts short — the pass then returned a fraction of what the feeds hold.
 * Each scheduled run now takes the next slice, so every desk is still read
 * within the hour and every run finishes inside its budget.
 */
export async function collectGallery(
  _apiKey?: string | undefined,
  opts?: { slice?: number; sliceSize?: number; keepFunnel?: boolean },
): Promise<CollectedItem[]> {
  const today = new Date().toISOString().slice(0, 10);
  if (!opts?.keepFunnel) {
    lastDiag.googleNews = { requested: 0, fetched: 0, returned: 0, errors: {}, bySource: {} };
    lastDiag.gallery = {
      discovered: 0,
      noImage: 0,
      imageUnusable: 0,
      hardNews: 0,
      candidates: 0,
      bySource: {},
    };
  }
  const all = PUBLISHER_FEEDS.filter((f) => GALLERY_FEED_NAMES.includes(f.name)).map((f) => ({
    ...f,
    limit: Math.max(f.limit ?? 6, 60),
  }));
  const size = Math.max(1, opts?.sliceSize ?? all.length);
  const slices = Math.max(1, Math.ceil(all.length / size));
  const start = ((opts?.slice ?? 0) % slices) * size;
  // Wrap the tail onto the start of the source list. With 57 desks and a
  // 14-desk slice, the old final slice contained only one desk and produced
  // the recurring low-intake runs seen by the editor.
  const feeds =
    size >= all.length
      ? all
      : Array.from({ length: Math.min(size, all.length) }, (_, index) =>
          all[(start + index) % all.length],
        ).filter((feed): feed is (typeof all)[number] => !!feed);
  const rows: CollectedItem[] = [];
  for (let b = 0; b < feeds.length; b += 6) {
    const batches = await Promise.all(
      feeds.slice(b, b + 6).map(async (feed) => {
        const items = await fetchPublisher(feed, { galleryMode: true });
        // No AI note on the picture path: a photo set needs no editorial
        // sentence, and the gateway call was collapsing the picture pool.
        return items.map((it) => {
          // Pictures key off the article URL, not the headline. Photo desks
          // reuse the same headline for every new set, so a title key made
          // each later gallery post look like a duplicate for ever.
          const dedupe = `gal-${keyFor("gal", urlKey(it.link || it.title))}`;
          const kind = classify(it.title);
          const summary = `${it.source || feed.name} photo feature.`;
          return {
            dedupe_key: dedupe,
            item_id: dedupe,
            digest_date: (it.published ?? `${today}T00:00:00Z`).slice(0, 10),
            kind,
            city_slug: BAY_AREA.slug,
            title: it.title,
            summary,
            source: it.source || feed.name,
            source_url: it.link,
            published_at: it.published,
            origin: "feed" as const,
            payload: {
              id: dedupe,
              kind,
              citySlug: BAY_AREA.slug,
              title: it.title,
              summary,
              source: it.source || feed.name,
              sourceUrl: it.link,
              image: it.image,
              gallery: true,
              collectedAt: today,
              // Glamour tags stamped at intake so the desk card and the
              // published picture carry star / region / event context.
              star: celebrityName(it.title, summary) ?? undefined,
              industry: industryLabel(it.title, summary, it.link),
              event: eventLabel(it.title, summary) ?? undefined,
            },

          } satisfies CollectedItem;
        });
      }),
    );
    rows.push(...batches.flat());
  }

  // Do not infer the people in a photograph from its headline. Every candidate
  // carrying usable artwork flows to the desk: the visual verifier is the sole
  // authority for admitting exactly one adult woman, so intake stays lenient
  // (hard news and male-only posts are the only text-level rejections).
  const { galleryImage } = await import("./story-image");
  const { pictureCandidateReason } = await import("./cinema-topics");
  const funnel = lastDiag.gallery;
  const kept: CollectedItem[] = [];
  for (const r of rows) {
    const source = r.source ?? "unknown";
    const stat = (funnel.bySource[source] ??= { discovered: 0, candidates: 0 });
    funnel.discovered += 1;
    stat.discovered += 1;
    const rawImage = (r.payload as { image?: string | null } | undefined)?.image ?? null;
    if (!rawImage) {
      funnel.noImage += 1;
      continue;
    }
    if (!galleryImage(rawImage)) {
      funnel.imageUnusable += 1;
      continue;
    }
    const reason = pictureCandidateReason(r.title, r.summary);
    if (reason === "hard_news") {
      funnel.hardNews += 1;
      continue;
    }
    funnel.candidates += 1;
    stat.candidates += 1;
    kept.push(r);
  }
  return dedupeCollected(kept);
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
  existing?: { titles?: Iterable<string>; urls?: Iterable<string>; content?: Iterable<string> },
): CollectedItem[] {
  const seenKey = new Set<string>();
  const seenContent = new Set(existing?.content ?? []);
  const seenUrl = new Set(existing?.urls ?? []);
  const unique: CollectedItem[] = [];
  for (const r of rows) {
    const keys = storyIdentityKeys(r.title, r.source_url);
    const urls = keys.filter((key) => key.startsWith("u:"));
    const contentKeys = keys.filter((key) => !key.startsWith("u:"));
    if (
      seenKey.has(r.dedupe_key) ||
      urls.some((key) => seenUrl.has(key) || seenContent.has(key)) ||
      contentKeys.some((key) => seenContent.has(key))
    ) {
      lastDiag.duplicates += 1;
      continue;
    }
    seenKey.add(r.dedupe_key);
    for (const key of keys) {
      if (key.startsWith("u:")) seenUrl.add(key);
      seenContent.add(key);
    }

    unique.push(r);
  }
  return unique;
}
