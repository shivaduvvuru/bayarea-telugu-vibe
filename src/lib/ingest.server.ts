import type { SupabaseClient } from "@supabase/supabase-js";
import { dedupeKey } from "@/lib/dedupe";
import { isSensitive } from "@/lib/auto-publish";

/**
 * Times Bay Area ingestion layer.
 *
 * Source-first: every item that enters the system is written to
 * raw_ingestion_items with its original title, canonical URL, publication time
 * and source. Connectors are generic (`connector_type`), so a commodity tool
 * such as GoodBarber can be plugged in later without the rest of the pipeline
 * knowing about it. Nothing here stores full third-party articles — only a
 * short excerpt, the link and metadata needed to build a digest card.
 */

export type ConnectorType =
  | "direct_rss"
  | "direct_api"
  | "goodbarber"
  | "manual"
  | "webhook"
  | "future_connector";

export type SourceRow = {
  id: string;
  name: string;
  source_url: string | null;
  rss_url: string | null;
  api_url: string | null;
  source_class: string;
  connector_type: ConnectorType;
  confidence: "high" | "medium" | "low";
  cities: string[];
  topics: string[];
  frequency_minutes: number;
  status: "healthy" | "error" | "inactive";
  active: boolean;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  items_discovered: number;
  items_published: number;
  duplicates_removed: number;
  notes: string | null;
};

export type FeedItem = {
  title: string;
  url: string;
  published: string | null;
  excerpt: string | null;
  image: string | null;
  author: string | null;
  externalId: string | null;
};

/** Topics that always wait for a human, per editorial policy. */
const REVIEW_ALWAYS = new Set([
  "immigration",
  "tax-money",
  "government",
  "public-safety",
]);

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export async function admin(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

function tag(block: string, name: string): string {
  const m =
    block.match(new RegExp(`<${name}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${name}>`, "i")) ??
    block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return (m?.[1] ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function attr(block: string, re: RegExp): string | null {
  return block.match(re)?.[1] ?? null;
}

/** Minimal RSS/Atom reader — no crawler, no paywall bypass. */
export function parseFeed(xml: string): FeedItem[] {
  const blocks =
    xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  const out: FeedItem[] = [];
  for (const b of blocks) {
    const title = tag(b, "title");
    const link =
      tag(b, "link") ||
      attr(b, /<link[^>]+href="([^"]+)"/i) ||
      tag(b, "guid");
    if (!title || !/^https?:\/\//.test(link)) continue;
    const published = tag(b, "pubDate") || tag(b, "updated") || tag(b, "published");
    const excerpt = (tag(b, "description") || tag(b, "summary") || "").slice(0, 400);
    out.push({
      title,
      url: link,
      published: published ? isoOrNull(published) : null,
      excerpt: excerpt || null,
      image:
        attr(b, /<media:content[^>]+url="([^"]+)"/i) ??
        attr(b, /<enclosure[^>]+url="([^"]+\.(?:jpe?g|png|webp)[^"]*)"/i) ??
        attr(b, /<img[^>]+src="([^"]+)"/i),
      author: tag(b, "dc:creator") || tag(b, "author") || null,
      externalId: tag(b, "guid") || null,
    });
  }
  return out;
}

function isoOrNull(value: string): string | null {
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** Strip tracking params so the same article always has one canonical URL. */
export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    [...u.searchParams.keys()]
      .filter((k) => /^(utm_|fbclid|gclid|mc_cid|mc_eid|ref)/i.test(k))
      .forEach((k) => u.searchParams.delete(k));
    return u.toString().replace(/\/$/, "");
  } catch {
    return raw;
  }
}

/** Fetch one source through its connector. Unimplemented connectors no-op. */
export async function collectFromSource(source: SourceRow): Promise<FeedItem[]> {
  const url =
    source.connector_type === "direct_api" ? source.api_url : source.rss_url ?? source.api_url;
  if (!url) return [];
  if (source.connector_type === "manual" || source.connector_type === "webhook") return [];
  if (source.connector_type === "goodbarber") {
    // Deliberately unimplemented: GoodBarber is an optional commodity trial,
    // never a dependency. Register the source and it stays inert until a real
    // structured feed is proven to work.
    return [];
  }
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, */*" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseFeed(await res.text());
}

export type IngestSummary = {
  sources: number;
  discovered: number;
  inserted: number;
  duplicates: number;
  errors: { source: string; error: string }[];
};

/**
 * One ingestion pass. Time-budgeted so a serverless run never overruns: due
 * sources are read oldest-first and the pass stops when the budget is spent.
 */
export async function runIngestion(options: { budgetMs?: number; sourceId?: string } = {}) {
  const db = await admin();
  const started = Date.now();
  const budget = options.budgetMs ?? 45_000;
  const summary: IngestSummary = {
    sources: 0,
    discovered: 0,
    inserted: 0,
    duplicates: 0,
    errors: [],
  };

  let query = db
    .from("content_sources")
    .select("*")
    .eq("active", true)
    .in("connector_type", ["direct_rss", "direct_api"])
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(12);
  if (options.sourceId) query = db.from("content_sources").select("*").eq("id", options.sourceId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const sources = (data ?? []) as SourceRow[];

  for (const source of sources) {
    if (Date.now() - started > budget) break;
    summary.sources += 1;
    const now = new Date().toISOString();
    try {
      const items = await collectFromSource(source);
      summary.discovered += items.length;
      let inserted = 0;
      let duplicates = 0;
      for (const item of items.slice(0, 25)) {
        const result = await storeRawItem(db, source, item);
        if (result === "inserted") inserted += 1;
        if (result === "duplicate") duplicates += 1;
      }
      summary.inserted += inserted;
      summary.duplicates += duplicates;
      await db
        .from("content_sources")
        .update({
          last_checked_at: now,
          last_success_at: now,
          last_error: null,
          status: "healthy",
          items_discovered: source.items_discovered + items.length,
          duplicates_removed: source.duplicates_removed + duplicates,
        })
        .eq("id", source.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      summary.errors.push({ source: source.name, error: message });
      await db
        .from("content_sources")
        .update({ last_checked_at: now, last_error: message.slice(0, 400), status: "error" })
        .eq("id", source.id);
    }
  }

  return summary;
}

/**
 * Cheap three-step de-duplication:
 *   1. canonical URL match
 *   2. normalized-headline match (shared dedupeKey)
 *   3. same city + topic + day
 * Matching items join a story cluster so several publishers become one card.
 */
async function storeRawItem(
  db: SupabaseClient,
  source: SourceRow,
  item: FeedItem,
): Promise<"inserted" | "duplicate" | "skipped"> {
  const url = canonicalUrl(item.url);
  const key = dedupeKey(item.title);
  if (!key) return "skipped";

  const { data: sameUrl } = await db
    .from("raw_ingestion_items")
    .select("id")
    .eq("canonical_url", url)
    .maybeSingle();
  if (sameUrl) return "duplicate";

  const city = source.cities[0] ?? null;
  const topic = source.topics[0] ?? null;
  const day = (item.published ?? new Date().toISOString()).slice(0, 10);

  const { data: sameKey } = await db
    .from("raw_ingestion_items")
    .select("id, story_cluster_id, source_name, city, topic, publication_datetime")
    .eq("dedupe_key", key)
    .limit(1);
  const twin = (sameKey ?? [])[0] as
    | { id: string; story_cluster_id: string | null; source_name: string }
    | undefined;

  let clusterId: string | null = twin?.story_cluster_id ?? null;
  let dedupeStatus: "unique" | "possible_duplicate" | "duplicate" = "unique";

  if (twin) {
    dedupeStatus = "possible_duplicate";
    if (!clusterId) {
      const { data: cluster } = await db
        .from("story_clusters")
        .upsert(
          {
            dedupe_key: key,
            headline: item.title,
            city,
            topic,
            source_names: [twin.source_name, source.name],
            item_count: 2,
          },
          { onConflict: "dedupe_key" },
        )
        .select("id")
        .maybeSingle();
      clusterId = (cluster as { id: string } | null)?.id ?? null;
      if (clusterId)
        await db.from("raw_ingestion_items").update({ story_cluster_id: clusterId }).eq("id", twin.id);
    }
  } else {
    // Step 3 — same city + topic + day is a likely retelling of one story.
    if (city && topic) {
      const { data: sameDay } = await db
        .from("raw_ingestion_items")
        .select("id")
        .eq("city", city)
        .eq("topic", topic)
        .gte("publication_datetime", `${day}T00:00:00Z`)
        .lte("publication_datetime", `${day}T23:59:59Z`)
        .ilike("original_title", `%${item.title.slice(0, 24)}%`)
        .limit(1);
      if ((sameDay ?? []).length) dedupeStatus = "possible_duplicate";
    }
  }

  const requiresReview =
    source.confidence === "low" ||
    isSensitive(item.title, item.excerpt) ||
    (topic ? REVIEW_ALWAYS.has(topic) : true);

  const { error } = await db.from("raw_ingestion_items").insert({
    source_id: source.id,
    source_name: source.name,
    connector_type: source.connector_type,
    external_item_id: item.externalId,
    original_title: item.title,
    canonical_url: url,
    excerpt: item.excerpt?.slice(0, 400) ?? null,
    image_url: item.image,
    author: item.author,
    publication_datetime: item.published,
    city,
    topic,
    dedupe_key: key,
    dedupe_status: dedupeStatus,
    story_cluster_id: clusterId,
    processing_status: "new",
    requires_human_review: requiresReview,
    priority_score: priorityScore(source, item),
  });
  if (error) {
    if (/duplicate key/i.test(error.message)) return "duplicate";
    throw new Error(error.message);
  }
  return "inserted";
}

/** Transparent rule-based score: authority + freshness + actionability. */
export function priorityScore(source: SourceRow, item: FeedItem): number {
  let score = 0;
  if (source.source_class === "authority") score += 30;
  else if (source.source_class === "reporter") score += 20;
  else if (source.source_class === "internal") score += 18;
  else score += 12;
  if (source.confidence === "high") score += 10;
  else if (source.confidence === "medium") score += 5;
  const ageHours = item.published
    ? (Date.now() - new Date(item.published).getTime()) / 3_600_000
    : 48;
  if (ageHours < 12) score += 25;
  else if (ageHours < 36) score += 15;
  else if (ageHours < 96) score += 5;
  const text = `${item.title} ${item.excerpt ?? ""}`;
  if (/\b(deadline|closure|register|apply|hearing|vote|meeting|festival|enrollment)\b/i.test(text))
    score += 15;
  if (/\b(telugu|indian|india|desi|hindu|temple)\b/i.test(text)) score += 8;
  return score;
}
