/**
 * First-party WordPress sources for the connected news editions.
 *
 * Posts are normalized here and then flow through the same collection pipeline
 * as every other source, including canonical URL/title/image deduplication.
 */
import { usableImage } from "./story-image";

export const WP_SITE = "https://bayarea.telugutimes.net";
export const WP_SOURCE_NAME = "Times Bay Area (WordPress)";
export const WP_ENGLISH_SITE = "https://www.telugutimes.net/en";
export const WP_ENGLISH_SOURCE_NAME = "Telugu Times English (WordPress)";

export const WORDPRESS_SOURCES = [
  { site: WP_SITE, name: WP_SOURCE_NAME },
  { site: WP_ENGLISH_SITE, name: WP_ENGLISH_SOURCE_NAME },
] as const;

export type WpPost = {
  title: string;
  link: string;
  summary: string;
  image: string | null;
  published: string | null;
  categorySlug: string | null;
  sourceName: string;
};

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#8217;|&#8216;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#nbsp;|&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&hellip;/g, "…")
    .replace(/&#8230;/g, "…")
    .replace(/\s+/g, " ")
    .trim();
}

/** First usable image from the embedded featured media or the post body. */
function imageOf(post: Record<string, any>): string | null {
  const media = post["_embedded"]?.["wp:featuredmedia"]?.[0];
  const candidates: string[] = [
    media?.media_details?.sizes?.large?.source_url,
    media?.media_details?.sizes?.full?.source_url,
    media?.source_url,
    (String(post["content"]?.rendered ?? "").match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? ""),
  ].filter(Boolean);
  for (const c of candidates) {
    const ok = usableImage(c);
    if (ok) return ok;
  }
  return null;
}

/** Category slug taken from the permalink path, ignoring the English locale. */
function categoryOf(link: string): string | null {
  try {
    const parts = new URL(link).pathname.split("/").filter(Boolean);
    const meaningful = parts[0]?.toLowerCase() === "en" ? parts.slice(1) : parts;
    return meaningful.length > 1 ? meaningful[0]!.toLowerCase() : null;
  } catch {
    return null;
  }
}

function toPost(p: Record<string, any>, sourceName: string): WpPost | null {
  const title = stripHtml(String(p["title"]?.rendered ?? ""));
  const link = String(p["link"] ?? "");
  if (!title || !/^https?:\/\//i.test(link)) return null;
  return {
    title,
    link,
    summary: stripHtml(String(p["excerpt"]?.rendered ?? "")).slice(0, 300),
    image: imageOf(p),
    published: p["date_gmt"] ? `${String(p["date_gmt"]).replace(/Z?$/, "")}Z` : null,
    categorySlug: categoryOf(link),
    sourceName,
  };
}

/** Fetch one WordPress edition through REST pagination. */
export async function fetchWordPressPosts(limit = 300, site = WP_SITE): Promise<WpPost[]> {
  const sourceName = WORDPRESS_SOURCES.find((source) => source.site === site)?.name ?? site;
  const out: WpPost[] = [];
  const perPage = 50;
  for (let page = 1; page <= Math.ceil(limit / perPage); page += 1) {
    const url = `${site}/wp-json/wp/v2/posts?per_page=${perPage}&page=${page}&status=publish&_embed=wp:featuredmedia`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "TimesBayArea/1.0" },
    });
    if (res.status === 400) break;
    if (!res.ok) {
      if (page === 1) throw new Error(`${sourceName} WordPress ${res.status}`);
      break;
    }
    const posts = (await res.json()) as Record<string, any>[];
    if (!Array.isArray(posts) || posts.length === 0) break;
    for (const p of posts) {
      const post = toPost(p, sourceName);
      if (post) out.push(post);
    }
    if (posts.length < perPage) break;
  }
  return out.slice(0, limit);
}

/** Fetch both editions. One unavailable edition must not hide the other. */
export async function fetchAllWordPressPosts(limit = 300): Promise<WpPost[]> {
  const results = await Promise.all(
    WORDPRESS_SOURCES.map(async (source) => {
      try {
        return await fetchWordPressPosts(limit, source.site);
      } catch (error) {
        console.error(`WordPress source failed: ${source.name}`, error);
        return [];
      }
    }),
  );
  return results.flat();
}

/**
 * Retires stories removed from either first-party WordPress edition. A failed
 * or empty pull never mass-hides anything; URLs are compared per source host.
 */
export async function syncWordPressRemovals(
  admin: { from: (t: string) => any },
  livePosts: WpPost[],
  sites = WORDPRESS_SOURCES,
): Promise<number> {
  const norm = (u: string) => u.replace(/^https?:\/\//, "").replace(/\/+$/, "").toLowerCase();
  const liveByHost = new Map<string, Set<string>>();
  for (const post of livePosts) {
    try {
      const host = new URL(post.link).hostname.toLowerCase();
      const set = liveByHost.get(host) ?? new Set<string>();
      set.add(norm(post.link));
      liveByHost.set(host, set);
    } catch {
      // Invalid source URLs cannot participate in removal decisions.
    }
  }
  if (!liveByHost.size) return 0;

  const gone: string[] = [];
  const queuedGone: string[] = [];
  for (const source of sites) {
    const host = new URL(source.site).hostname;
    const live = liveByHost.get(host);
    if (!live?.size) continue;

    const { data } = await admin
      .from("content_items")
      .select("id, link_url")
      .neq("placement", "hidden")
      .ilike("link_url", `%${host}%`)
      .limit(2000);
    for (const row of (data ?? []) as { id: string; link_url: string | null }[]) {
      if (row.link_url && !live.has(norm(row.link_url))) gone.push(row.id);
    }

    const { data: queued } = await admin
      .from("digest_queue")
      .select("item_id, source_url")
      .ilike("source_url", `%${host}%`)
      .limit(2000);
    for (const row of (queued ?? []) as { item_id: string; source_url: string | null }[]) {
      if (row.source_url && !live.has(norm(row.source_url))) queuedGone.push(row.item_id);
    }
  }

  const uniqueGone = [...new Set(gone)];
  for (let i = 0; i < uniqueGone.length; i += 200) {
    await admin
      .from("content_items")
      .update({ placement: "hidden", status: "removed" })
      .in("id", uniqueGone.slice(i, i + 200));
  }

  const uniqueQueuedGone = [...new Set(queuedGone)];
  for (let i = 0; i < uniqueQueuedGone.length; i += 200) {
    await admin
      .from("digest_queue")
      .update({ status: "rejected" })
      .in("item_id", uniqueQueuedGone.slice(i, i + 200));
  }

  return uniqueGone.length;
}
