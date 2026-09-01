/**
 * Daily syndication of New India Abroad headlines.
 *
 * We only ever store the headline, a short excerpt, the hero image URL and the
 * canonical link — never article text — because republishing full stories needs
 * the publisher's permission. Every card credits and links back to the source.
 *
 * They publish no RSS feed, but they do publish a Google-News sitemap that is
 * ordered newest-first, so one gzipped read gives us the day's headlines
 * (title + publish date + URL) without crawling section pages. Only the
 * matching article pages are then fetched, politely and rate-limited, for the
 * og:image / og:description pair.
 *
 * Server-only: never import from a route component.
 */

const SOURCE_NAME = "New India Abroad";
const SITEMAP_URL = "https://www.newindiaabroad.com/english/news/sitemap.xml.gz";
const USER_AGENT =
  "TimesBayAreaBot/1.0 (+https://www.timesbayarea.com; news digest, contact: editor@timesbayarea.com)";

/** Sections we never syndicate; everything else under /english/ is fair game. */
const BLOCKED_SECTIONS = ["sponsored", "advertorial", "press-release", "opinion"];


const MAX_AGE_MS = 3 * 24 * 3600 * 1000;
const MAX_ITEMS = 40;
/** Politeness gap between article fetches. */
const FETCH_GAP_MS = 400;
const EXCERPT_MAX = 300;

export type SyndicatedRow = {
  source_name: string;
  source_category: string | null;
  title: string;
  excerpt: string | null;
  canonical_url: string;
  image_url: string | null;
  published_at: string | null;
  fetched_at: string;
  status: "published";
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function decodeEntities(text: string): string {
  return text
    .replace(/&apos;|&#39;|&#x27;/g, "'")
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#8216;|&lsquo;/g, "‘")
    .replace(/&#8220;|&ldquo;/g, "“")
    .replace(/&#8221;|&rdquo;/g, "”")
    .replace(/&#8211;|&ndash;/g, "–")
    .trim();
}

/** Strips tracking noise so re-runs dedupe on a stable key. */
export function canonicalStoryUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    u.search = "";
    u.hostname = u.hostname.replace(/^www\./i, "");
    u.pathname = u.pathname.replace(/\/+$/, "");
    return `https://${u.hostname}${u.pathname}`;
  } catch {
    return raw;
  }
}

export function sectionOf(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    // /english/<section>/<slug>
    if (parts[0]?.toLowerCase() !== "english") return null;
    return parts[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

/** Reads the head of the gzipped sitemap — newest entries come first. */
async function fetchSitemapHead(bytes = 600_000): Promise<string> {
  const res = await fetch(SITEMAP_URL, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/xml,*/*" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`sitemap ${res.status}`);
  const enc = (res.headers.get("content-encoding") ?? "").toLowerCase();
  let stream: ReadableStream<Uint8Array> = res.body as ReadableStream<Uint8Array>;
  if (!stream) return "";
  // Servers that already decoded the gzip set content-encoding; otherwise the
  // .gz body needs decompressing ourselves.
  if (!enc.includes("gzip") && typeof DecompressionStream !== "undefined") {
    try {
      stream = stream.pipeThrough(new DecompressionStream("gzip") as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
    } catch {
      /* already plain XML */
    }
  }
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = "";
  try {
    while (out.length < bytes) {
      const { done, value } = await reader.read();
      if (done) break;
      out += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return out;
}

type SitemapEntry = { url: string; title: string; publishedAt: string | null; section: string };

export function parseSitemapEntries(xml: string): SitemapEntry[] {
  const out: SitemapEntry[] = [];
  const blocks = xml.split("<url>").slice(1);
  for (const block of blocks) {
    const loc = /<loc>\s*([^<]+?)\s*<\/loc>/.exec(block)?.[1];
    if (!loc) continue;
    const url = canonicalStoryUrl(loc);
    const section = sectionOf(loc) ?? "";
    if (!section || BLOCKED_SECTIONS.includes(section)) continue;
    const title = decodeEntities(/<news:title>([\s\S]*?)<\/news:title>/.exec(block)?.[1] ?? "");
    const date = /<news:publication_date>\s*([^<]+?)\s*<\/news:publication_date>/.exec(block)?.[1];
    if (!title) continue;
    out.push({ url, title, publishedAt: date ? new Date(date).toISOString() : null, section });
  }
  return out;
}

function metaOf(html: string, key: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`,
    "i",
  );
  const m = re.exec(html)?.[1] ?? alt.exec(html)?.[1];
  return m ? decodeEntities(m) : null;
}

/** Headline-page metadata only: og:image + og:description. No article text. */
async function fetchStoryMeta(url: string): Promise<{ image: string | null; excerpt: string | null }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      redirect: "follow",
    });
    if (!res.ok) return { image: null, excerpt: null };
    const html = (await res.text()).slice(0, 250_000);
    const image = metaOf(html, "og:image") ?? metaOf(html, "twitter:image");
    const raw = metaOf(html, "og:description") ?? metaOf(html, "description");
    const excerpt = raw
      ? raw.length > EXCERPT_MAX
        ? `${raw.slice(0, EXCERPT_MAX - 1).replace(/\s+\S*$/, "")}…`
        : raw
      : null;
    return { image: image && /^https?:\/\//i.test(image) ? image : null, excerpt };
  } catch {
    return { image: null, excerpt: null };
  }
}

export type SyndicationSummary = {
  ok: boolean;
  fetched: number;
  candidates: number;
  inserted: number;
  updated: number;
  error: string | null;
  elapsedMs: number;
};

/**
 * One pass: read the sitemap head, keep fresh English section stories, enrich
 * with image/excerpt and upsert on the canonical URL so re-runs never duplicate.
 * Failures are logged and reported — the reader-facing block simply keeps
 * showing the last successful set.
 */
export async function syndicateNewIndiaAbroad(
  trigger: "cron" | "manual" = "cron",
): Promise<SyndicationSummary> {
  const startedAt = Date.now();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as never as {
    from: (t: string) => any;
  };
  let fetched = 0;
  let candidates = 0;
  let inserted = 0;
  let updated = 0;
  let error: string | null = null;

  try {
    const xml = await fetchSitemapHead();
    const entries = parseSitemapEntries(xml);
    fetched = entries.length;
    const cutoff = Date.now() - MAX_AGE_MS;
    const fresh = entries
      .filter((e) => !e.publishedAt || new Date(e.publishedAt).getTime() >= cutoff)
      .slice(0, MAX_ITEMS);
    candidates = fresh.length;

    const urls = fresh.map((e) => e.url);
    const { data: existingRows } = await db
      .from("syndicated_stories")
      .select("canonical_url,image_url,excerpt")
      .in("canonical_url", urls.length ? urls : ["__none__"]);
    const existing = new Map<string, { image_url: string | null; excerpt: string | null }>(
      ((existingRows ?? []) as Array<{ canonical_url: string; image_url: string | null; excerpt: string | null }>).map(
        (r) => [r.canonical_url, { image_url: r.image_url, excerpt: r.excerpt }],
      ),
    );

    const rows: SyndicatedRow[] = [];
    for (const entry of fresh) {
      const known = existing.get(entry.url);
      // Already enriched: refresh nothing, keep any editor-edited excerpt.
      if (known?.image_url && known.excerpt) {
        updated += 1;
        continue;
      }
      const meta = await fetchStoryMeta(entry.url);
      rows.push({
        source_name: SOURCE_NAME,
        source_category: entry.section,
        title: entry.title,
        excerpt: meta.excerpt ?? known?.excerpt ?? null,
        canonical_url: entry.url,
        image_url: meta.image ?? known?.image_url ?? null,
        published_at: entry.publishedAt,
        fetched_at: new Date().toISOString(),
        status: "published",
      });
      if (!known) inserted += 1;
      else updated += 1;
      await sleep(FETCH_GAP_MS);
    }

    if (rows.length) {
      const { error: upsertError } = await db
        .from("syndicated_stories")
        .upsert(rows, { onConflict: "canonical_url" });
      if (upsertError) throw new Error(upsertError.message);
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    inserted = 0;
  }

  const elapsedMs = Date.now() - startedAt;
  await db
    .from("syndication_runs")
    .insert({
      source_name: SOURCE_NAME,
      trigger,
      fetched_count: candidates,
      new_count: inserted,
      error: error ? error.slice(0, 500) : null,
      elapsed_ms: elapsedMs,
      started_at: new Date(startedAt).toISOString(),
      finished_at: new Date().toISOString(),
    })
    .then?.(() => {})
    ?.catch?.(() => {});

  return { ok: !error, fetched, candidates, inserted, updated, error, elapsedMs };
}
