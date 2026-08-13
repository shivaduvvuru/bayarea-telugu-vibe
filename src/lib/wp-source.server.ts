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

/** Latest published posts from the WordPress site. */
export async function fetchWordPressPosts(limit = 20): Promise<WpPost[]> {
  const url = `${WP_SITE}/wp-json/wp/v2/posts?per_page=${Math.min(limit, 50)}&status=publish&_embed=wp:featuredmedia`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "BayAreaTeluguTimes/1.0" },
  });
  if (!res.ok) throw new Error(`WordPress ${res.status}`);
  const posts = (await res.json()) as Record<string, any>[];
  const out: WpPost[] = [];
  for (const p of Array.isArray(posts) ? posts : []) {
    const title = stripHtml(String(p["title"]?.rendered ?? ""));
    const link = String(p["link"] ?? "");
    if (!title || !link) continue;
    out.push({
      title,
      link,
      summary: stripHtml(String(p["excerpt"]?.rendered ?? "")).slice(0, 300),
      image: imageOf(p),
      published: p["date_gmt"] ? `${String(p["date_gmt"]).replace(/Z?$/, "")}Z` : null,
      categorySlug: categoryOf(link),
    });
  }
  return out;
}
