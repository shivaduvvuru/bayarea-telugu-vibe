/**
 * Fetches posts from the newspaper's own WordPress site
 * (bayarea.telugutimes.net) through the public WP REST API.
 *
 * This is a first-party source: posts come with a clean excerpt and a featured
 * image, so they need no AI summary and no link resolution. Items flow into the
 * same collection pipeline (and therefore the same duplicate checks) as the
 * syndicated digest feeds.
 */
import { usableImage } from "./story-image";

export const WP_SITE = "https://bayarea.telugutimes.net";
export const WP_SOURCE_NAME = "Bay Area Telugu Times (WordPress)";

export type WpPost = {
  title: string;
  link: string;
  summary: string;
  image: string | null;
  published: string | null;
  categorySlug: string | null;
};

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#8217;|&#8216;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&hellip;/g, "…")
    .replace(/\s+/g, " ")
    .trim();
}

/** First usable image from the embedded featured media or the post body. */
function imageOf(post: Record<string, any>): string | null {
  const media = post["_embedded"]?.["wp:featuredmedia"]?.[0];
  const candidates: string[] = [
    media?.source_url,
    media?.media_details?.sizes?.large?.source_url,
    media?.media_details?.sizes?.full?.source_url,
    (String(post["content"]?.rendered ?? "").match(/<img[^>]+src="([^"]+)"/i)?.[1] ?? ""),
  ].filter(Boolean);
  for (const c of candidates) {
    const ok = usableImage(c);
    if (ok) return ok;
  }
  return null;
}

/** Category slug taken from the permalink path (…/cinema/slug/). */
function categoryOf(link: string): string | null {
  try {
    const parts = new URL(link).pathname.split("/").filter(Boolean);
    return parts.length > 1 ? parts[0]!.toLowerCase() : null;
  } catch {
    return null;
  }
}

function toPost(p: Record<string, any>): WpPost | null {
  const title = stripHtml(String(p["title"]?.rendered ?? ""));
  const link = String(p["link"] ?? "");
  if (!title || !link) return null;
  return {
    title,
    link,
    summary: stripHtml(String(p["excerpt"]?.rendered ?? "")).slice(0, 300),
    image: imageOf(p),
    published: p["date_gmt"] ? `${String(p["date_gmt"]).replace(/Z?$/, "")}Z` : null,
    categorySlug: categoryOf(link),
  };
}

/**
 * Every published post on the WordPress site, walking the REST pagination.
 * The site mirrors WordPress exactly, so we read the whole catalogue rather
 * than only the newest page.
 */
export async function fetchWordPressPosts(limit = 300): Promise<WpPost[]> {
  const out: WpPost[] = [];
  const perPage = 50;
  for (let page = 1; page <= Math.ceil(limit / perPage); page += 1) {
    const url = `${WP_SITE}/wp-json/wp/v2/posts?per_page=${perPage}&page=${page}&status=publish&_embed=wp:featuredmedia`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "BayAreaTeluguTimes/1.0" },
    });
    if (res.status === 400) break; // past the last page
    if (!res.ok) {
      if (page === 1) throw new Error(`WordPress ${res.status}`);
      break;
    }
    const posts = (await res.json()) as Record<string, any>[];
    if (!Array.isArray(posts) || posts.length === 0) break;
    for (const p of posts) {
      const post = toPost(p);
      if (post) out.push(post);
    }
    if (posts.length < perPage) break;
  }
  return out.slice(0, limit);
}

/**
 * Retires stories that no longer exist on the WordPress site.
 *
 * The Bay Area edition mirrors bayarea.telugutimes.net, so when the newsroom
 * unpublishes or deletes a post there it must vanish here at the same time.
 * Anything we ingested from the WP site whose URL is missing from the live post
 * list gets hidden (kept for audit, never shown).
 */
export async function syncWordPressRemovals(
  admin: { from: (t: string) => any },
  livePosts: WpPost[],
): Promise<number> {
  const norm = (u: string) => u.replace(/^https?:\/\//, "").replace(/\/+$/, "").toLowerCase();
  const live = new Set(livePosts.map((p) => norm(p.link)));
  if (live.size === 0) return 0; // never mass-hide on a failed pull

  const { data } = await admin
    .from("content_items")
    .select("id, link_url")
    .neq("placement", "hidden")
    .ilike("link_url", `%bayarea.telugutimes.net%`)
    .limit(2000);

  const gone = ((data ?? []) as { id: string; link_url: string | null }[])
    .filter((r) => r.link_url && !live.has(norm(r.link_url)))
    .map((r) => r.id);

  for (let i = 0; i < gone.length; i += 200) {
    await admin
      .from("content_items")
      .update({ placement: "hidden", status: "removed" })
      .in("id", gone.slice(i, i + 200));
  }

  // Keep the review queue in step too, so a removed post is not re-published.
  if (gone.length) {
    await admin
      .from("digest_queue")
      .update({ status: "rejected" })
      .ilike("source_url", "%bayarea.telugutimes.net%")
      .not("source_url", "in", `(${[...live].map((u) => `"https://${u}"`).join(",")})`);
  }

  return gone.length;
}

