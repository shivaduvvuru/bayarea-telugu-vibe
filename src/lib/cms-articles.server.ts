/**
 * Reads the site's own content store (Lovable Cloud) as Article DTOs.
 *
 * This is the only content source: the site has no external publisher feed.
 */
import type { Article } from "./content";
import { categoryBySlug, CITY_CATEGORIES } from "./content";
import { publicClient } from "./cms.server";
import { sanitizeHtml } from "./sanitize";
import { sourceLabel, usableImage } from "./story-image";
import { classifyIndia, INDIA_SLUGS } from "./india-topics";
import { isCinema, isStarGallery, CINEMA_SLUG } from "./cinema-topics";
import { dedupeKey } from "./dedupe";

/**
 * Last line of defence against duplicates reaching a reader: collapse articles
 * that share a normalised headline, a link or a lead image. Applied to every
 * read path so no section (home, city news, cinema, gallery) can show a story
 * twice even if the store still holds a near-copy.
 */
function dedupeArticles(items: Article[]): Article[] {
  const seen = new Set<string>();
  const out: Article[] = [];
  for (const a of items) {
    const keys = [
      dedupeKey(a.title ?? ""),
      a.sourceUrl ? `u:${a.sourceUrl.split("?")[0]!.replace(/\/$/, "").toLowerCase()}` : "",
      a.image ? `i:${a.image.split("?")[0]!.toLowerCase()}` : "",
    ].filter(Boolean);
    if (keys.some((k) => seen.has(k))) continue;
    for (const k of keys) seen.add(k);
    out.push(a);
  }
  return out;
}

/** Stable numeric id derived from the row uuid (Article.id is a number). */
function numericId(uuid: string) {
  let h = 0;
  for (let i = 0; i < uuid.length; i += 1) h = (h * 31 + uuid.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** CMS-backed articles use a `c-<uuid>` slug so lookups stay unambiguous. */
export function cmsSlug(id: string) {
  return `c-${id}`;
}

type Row = {
  id: string;
  title: string;
  summary: string | null;
  body: string | null;
  image_url: string | null;
  link_url: string | null;
  city: string | null;
  category: string | null;
  published_at: string | null;
  created_at: string;
};

const COLUMNS =
  "id, title, summary, body, image_url, link_url, city, category, published_at, created_at";

/** City rows store the display name ("San Jose"); pages address them by slug. */
function citySlugOf(city: string | null): string | undefined {
  if (!city) return undefined;
  const needle = city.trim().toLowerCase();
  return CITY_CATEGORIES.find((c) => c.en.toLowerCase() === needle || c.slug === needle)?.slug;
}

function cityNameOf(slug: string): string | undefined {
  return CITY_CATEGORIES.find((c) => c.slug === slug)?.en;
}

function toArticle(row: Row): Article {
  // Rows published before the India sections existed carry a plain "news"
  // category; label them from their text so cards read correctly. Our own
  // WordPress newsroom is first-party local reporting and is never relabelled
  // into an India section.
  const ownSite = (row.link_url ?? "").includes("bayarea.telugutimes.net");
  const stored =
    !ownSite && (row.category === "news" || !row.category)
      ? isCinema(row.title, row.summary, row.link_url)
        ? CINEMA_SLUG
        : (classifyIndia(row.title, row.summary, row.link_url) ?? row.category)
      : row.category;

  // Cinema is a topic, not a place: a film story filed to a city still belongs
  // in Cinema.
  const slug =
    stored === CINEMA_SLUG ? CINEMA_SLUG : (citySlugOf(row.city) ?? stored ?? "community");
  const cat = categoryBySlug(slug);
  const text = row.summary ?? "";
  return {
    id: numericId(row.id),
    slug: cmsSlug(row.id),
    title: row.title,
    excerpt: text.slice(0, 300),
    html: sanitizeHtml(row.body ?? (text ? `<p>${text}</p>` : "")),
    date: row.published_at ?? row.created_at,
    author: "Bay Area Telugu Times",
    image: usableImage(row.image_url),
    category: slug,
    categoryName: cat?.en ?? "Community",
    sourceName: sourceLabel(row.link_url),
    sourceUrl: row.link_url,
  };
}

function base() {
  return publicClient()
    .from("content_items")
    .select(COLUMNS)
    .eq("status", "published")
    .neq("placement", "hidden")
    .in("kind", ["news", "announcement", "event"]);
}

/** Published stories for a category/city slug (or everything when omitted). */
export async function cmsPosts(category: string | undefined, limit: number): Promise<Article[]> {
  let q = base().order("published_at", { ascending: false }).limit(limit);
  if (category === "city-news") {
    // Bay Area local reporting only — India coverage lives under /category/india-news.
    q = base()
      .order("published_at", { ascending: false })
      .limit(limit * 4)
      .not("city", "is", null);
  } else if (category === "gallery") {
    // Gallery is a star picture desk: heroine / star photo features from
    // Telugu, Hindi and OTT cinema — not the cinema headline feed.
    q = base()
      .order("published_at", { ascending: false })
      .limit(400)
      .not("image_url", "is", null);

  } else if (category === "cinema") {
    // Older film stories were stored as plain "news"; pull both and let the
    // classifier decide.
    q = base()
      .order("published_at", { ascending: false })
      .limit(limit * 4)
      .in("category", ["cinema", "news"]);
  } else if (category === "india-news") {
    // Explicit India sections plus anything the classifier recognises as
    // India coverage that was filed under a generic bucket.
    q = base()
      .order("published_at", { ascending: false })
      .limit(limit * 6)
      .in("category", [...INDIA_SLUGS, "news", "political"]);
  } else if (category) {
    const cityName = cityNameOf(category);
    const clauses = [`category.eq.${category}`, `city.eq.${category}`];
    if (cityName) clauses.push(`city.eq.${cityName}`);
    q = q.or(clauses.join(","));
  }
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as unknown as Row[];
  if (category === "gallery") {
    return dedupeArticles(
      rows
        .filter((r) => isStarGallery(r.title, r.summary, r.link_url) && usableImage(r.image_url))
        .map(toArticle),
    ).slice(0, limit);
  }
  if (category === "india-news") {
    return dedupeArticles(
      rows
        .filter(
          (r) =>
            INDIA_SLUGS.includes(r.category as (typeof INDIA_SLUGS)[number]) ||
            classifyIndia(r.title, r.summary, r.link_url) !== null,
        )
        .map(toArticle),
    ).slice(0, limit);
  }
  if (category === "city-news") {
    // Local Bay Area reporting only: no India coverage and no film/gallery
    // stories (cinema is a topic of its own, even when filed to a city).
    // Rows already filed to an India section are excluded by their stored
    // category; generic rows are classified from their text. First-party
    // newsroom posts (our own WordPress site) are always local.
    const firstParty = (r: Row) => (r.link_url ?? "").includes("bayarea.telugutimes.net");
    return dedupeArticles(
      rows
        .filter((r) => {
          if (r.category === CINEMA_SLUG) return false;
          if (firstParty(r)) return !isStarGallery(r.title, r.summary, r.link_url);
          if (INDIA_SLUGS.includes(r.category as (typeof INDIA_SLUGS)[number])) return false;
          const generic = !r.category || r.category === "news";
          if (generic && classifyIndia(r.title, r.summary, r.link_url) !== null) return false;
          return (
            !isCinema(r.title, r.summary, r.link_url) &&
            !isStarGallery(r.title, r.summary, r.link_url)
          );
        })
        .map(toArticle),
    )
      .filter((a) => a.category !== CINEMA_SLUG)
      .slice(0, limit);
  }


  const articles = dedupeArticles(rows.map(toArticle));
  if (category === "cinema") {
    return articles.filter((a) => a.category === "cinema").slice(0, limit);
  }

  return articles;


}

export async function cmsPost(slug: string): Promise<Article | null> {
  if (!slug.startsWith("c-")) return null;
  const { data, error } = await base().eq("id", slug.slice(2)).limit(1).maybeSingle();
  if (error || !data) return null;
  return toArticle(data as unknown as Row);
}

export async function cmsSearch(q: string, limit = 20): Promise<Article[]> {
  const needle = q.replace(/[%,()]/g, " ").trim();
  if (!needle) return [];
  const { data, error } = await base()
    .or(`title.ilike.%${needle}%,summary.ilike.%${needle}%`)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return dedupeArticles(((data ?? []) as unknown as Row[]).map(toArticle));
}
