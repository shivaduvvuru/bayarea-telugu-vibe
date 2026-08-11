/**
 * Reads the site's own content store (Lovable Cloud) as Article DTOs.
 *
 * This is the only content source: the site has no external publisher feed.
 */
import type { Article } from "./content";
import { categoryBySlug, CITY_CATEGORIES } from "./content";
import { publicClient } from "./cms.server";
import { sanitizeHtml } from "./sanitize";

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
  const slug = citySlugOf(row.city) ?? row.category ?? "community";
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
    image: row.image_url,
    category: slug,
    categoryName: cat?.en ?? "Community",
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
    q = q.not("city", "is", null);
  } else if (category) {
    const cityName = cityNameOf(category);
    const clauses = [`category.eq.${category}`, `city.eq.${category}`];
    if (cityName) clauses.push(`city.eq.${cityName}`);
    q = q.or(clauses.join(","));
  }
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(toArticle);
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
  return ((data ?? []) as unknown as Row[]).map(toArticle);
}
