/**
 * Reads the site's own content store (Lovable Cloud) as Article DTOs.
 *
 * This is the only content source: the site has no external publisher feed.
 */
import type { Article } from "./content";
import { categoryBySlug, CITY_CATEGORIES } from "./content";
import { isBayArea, isBayAreaSource, BAY_HOSTS } from "./bay-area";
import { publicClient } from "./cms.server";
import { sanitizeHtml } from "./sanitize";
import { galleryImage, sourceLabel, usableImage } from "./story-image";
import { classifyIndia, INDIA_SLUGS } from "./india-topics";
import { isCinema, isStarGallery, CINEMA_SLUG } from "./cinema-topics";
import { isMicroDrama, MICRO_DRAMA_SLUG } from "./microdrama-topics";
import { dedupeKey } from "./dedupe";

/**
 * Last line of defence against duplicates reaching a reader: collapse articles
 * that share a normalised headline, a link or a lead image. Applied to every
 * read path so no section (home, city news, cinema, gallery) can show a story
 * twice even if the store still holds a near-copy.
 */
function dedupeArticles(items: Article[]): Article[] {
  // Uses the shared content keys so a re-worded headline of the same story
  // (same lead, different tail) collapses as well as an exact repeat.
  return uniqueByContent(items);
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
  source?: string | null;
};

const COLUMNS =
  "id, title, summary, body, image_url, link_url, city, category, published_at, created_at, source";

/** City rows store the display name ("San Jose"); pages address them by slug. */
function citySlugOf(city: string | null): string | undefined {
  if (!city) return undefined;
  const needle = city.trim().toLowerCase();
  return CITY_CATEGORIES.find((c) => c.en.toLowerCase() === needle || c.slug === needle)?.slug;
}

function cityNameOf(slug: string): string | undefined {
  return CITY_CATEGORIES.find((c) => c.slug === slug)?.en;
}

/** First-party newsroom posts carry their section in the permalink path. */
function ownSiteSection(link: string | null): string | null {
  if (!link || !link.includes("bayarea.telugutimes.net")) return null;
  try {
    const seg = new URL(link).pathname.split("/").filter(Boolean)[0]?.toLowerCase();
    return seg ?? null;
  } catch {
    return null;
  }
}

function toArticle(row: Row): Article {
  // Rows published before the India sections existed carry a plain "news"
  // category; label them from their text so cards read correctly. Our own
  // WordPress newsroom is first-party local reporting: it keeps the section
  // from its own permalink and is never relabelled into an India section.
  const own = ownSiteSection(row.link_url);
  const stored =
    own !== null
      ? own === "cinema"
        ? CINEMA_SLUG
        : (row.category === "news" || !row.category ? (own === "temples" ? "temples" : own === "events" ? "events" : row.category) : row.category)
      : row.category === "news" || !row.category
        ? isMicroDrama(row.title, row.summary, row.link_url) ||
          isCinema(row.title, row.summary, row.link_url)
          ? CINEMA_SLUG
          : (classifyIndia(row.title, row.summary, row.link_url) ?? row.category)
        : row.category;


  // Cinema is a topic, not a place: a film story filed to a city still belongs
  // in Cinema. Micro-drama is part of the Cinema/OTT desk, so rows filed to the
  // old micro-drama bucket read as Cinema/OTT.
  const slug =
    stored === CINEMA_SLUG || stored === MICRO_DRAMA_SLUG
      ? CINEMA_SLUG
      : (citySlugOf(row.city) ?? stored ?? "community");
  const cat = categoryBySlug(slug);
  const text = row.summary ?? "";
  return {
    id: numericId(row.id),
    slug: cmsSlug(row.id),
    title: row.title,
    excerpt: text.slice(0, 300),
    html: sanitizeHtml(row.body ?? (text ? `<p>${text}</p>` : "")),
    date: row.published_at ?? row.created_at,
    author: "Times Bay Area",
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
export async function cmsPosts(
  category: string | undefined,
  limit: number,
  page = 0,
): Promise<Article[]> {
  let q = base().order("published_at", { ascending: false }).limit(limit);

  if (category === "city-news") {
    // Bay Area local reporting only — India coverage lives under /category/india-news.
    // The pool has to be wide: most rows filed to a Bay Area city are India or
    // cinema syndication, so a small window would crowd out local reporting and
    // our own newsroom posts.
    q = base()
      .order("published_at", { ascending: false })
      .limit(400)
      .not("city", "is", null);

  } else if (category === "gallery") {
    // Gallery is a star picture desk: heroine / star photo features from
    // Telugu, Hindi and OTT cinema — not the cinema headline feed. The pool has
    // to stay wide because most picture rows are headline stories, so a narrow
    // window would starve the grid as the archive grows.
    q = base()
      .order("published_at", { ascending: false })
      .limit(1200)
      .not("image_url", "is", null);



  } else if (category === "cinema") {
    // Cinema is a picture desk too: only film stories that carry a usable photo
    // make the feed. Older film stories were stored as plain "news" and vertical
    // micro-drama coverage now lives on this desk as well; pull all three and
    // let the classifier decide. The pool stays wide because the image filter
    // drops a lot of rows.
    q = base()
      .order("published_at", { ascending: false })
      .limit(Math.max(limit * 12, 400))
      .not("image_url", "is", null)
      .in("category", ["cinema", MICRO_DRAMA_SLUG, "news"]);

  } else if (category === "micro-drama") {
    // Micro-drama is a young desk. Rows already filed to it are read in a
    // dedicated pass below; here we only widen the pool so film/OTT rows that
    // were filed generically can still be classified into the format.
    q = base()
      .order("published_at", { ascending: false })
      .limit(Math.max(limit * 20, 600))
      .in("category", [MICRO_DRAMA_SLUG, "cinema", "news"]);

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
    // Editor-approved picture sets are the point of the desk: read them in their
    // own pass (so a busy news day can never push them out of the shared pool)
    // and show them ahead of the automatically collected photos.
    const { data: picked } = await base()
      .order("published_at", { ascending: false })
      .limit(300)
      .not("image_url", "is", null)
      .eq("category", "gallery");
    // Category=gallery rows are editor-approved picks. Do not run them back
    // through the automatic intake classifier after approval.
    const pickedRows = ((picked ?? []) as unknown as Row[]).filter((r) =>
      galleryImage(r.image_url),
    );
    const auto = rows.filter(
      (r) => isStarGallery(r.title, r.summary, r.link_url) && galleryImage(r.image_url),
    );
    // `page` walks a window through the whole picture folder, so a later read
    // returns photos the reader has not been shown yet instead of the same
    // newest batch. Falls back to the first window once the folder runs out.
    const all = dedupeArticles([...pickedRows, ...auto].map(toArticle));
    const from = page * limit;
    return from < all.length ? all.slice(from, from + limit) : all.slice(0, limit);

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
  if (category === "micro-drama") {
    // Rows filed to the micro-drama desk are read on their own so a busy news
    // day can never crowd them out of the shared pool.
    const { data: filed } = await base()
      .order("published_at", { ascending: false })
      .limit(200)
      .eq("category", MICRO_DRAMA_SLUG);
    const filedRows = (filed ?? []) as unknown as Row[];
    const auto = rows.filter(
      (r) => r.category !== MICRO_DRAMA_SLUG && isMicroDrama(r.title, r.summary, r.link_url),
    );
    // Illustrated stories lead the desk: the page shows photo cards first and
    // keeps text-only items as short snippets underneath.
    const all = dedupeArticles([...filedRows, ...auto].map(toArticle));
    return [...all.filter((a) => a.image), ...all.filter((a) => !a.image)].slice(0, limit);
  }


  if (category === "city-news") {
    // The newest 400 city-filed rows are dominated by India/cinema syndication,
    // which used to push every local report (our own newsroom, Patch, Bay Area
    // dailies, city halls) out of the window and left the page empty. Read the
    // local publishers in their own pass so they can never be crowded out.
    const localPatterns = [
      "bayarea.telugutimes.net",
      "patch.com/california",
      ...BAY_HOSTS,
    ].map((h) => `link_url.ilike.%${h}%`);
    const { data: localData } = await base()
      .or(localPatterns.join(","))
      .order("published_at", { ascending: false })
      .limit(400);
    const localRows = (localData ?? []) as unknown as Row[];
    // Local reporting only: no India coverage and no film/gallery
    // stories (cinema is a topic of its own, even when filed to a city).
    // Rows already filed to an India section are excluded by their stored
    // category; generic rows are classified from their text. First-party
    // newsroom posts (our own WordPress site) are always local.
    return dedupeArticles(
      [...localRows, ...rows]

        .filter((r) => {
          if (r.category === CINEMA_SLUG || r.category === MICRO_DRAMA_SLUG) return false;
          if (isMicroDrama(r.title, r.summary, r.link_url)) return false;
          const own = ownSiteSection(r.link_url);
          if (own !== null) return own !== "cinema" && own !== "gallery";

          if (INDIA_SLUGS.includes(r.category as (typeof INDIA_SLUGS)[number])) return false;
          // India coverage never belongs in the Bay Area feed, whatever bucket
          // it was filed under (a Punjab story collected by the temple pass is
          // still India news).
          if (classifyIndia(r.title, r.summary, r.link_url) !== null) return false;
          if (isCinema(r.title, r.summary, r.link_url)) return false;
          if (isStarGallery(r.title, r.summary, r.link_url)) return false;
          // Positive local signal required. Collected rows carry a blanket
          // "Bay Area" city stamp and their AI summaries often name the region,
          // so relevance is judged on the headline and the publisher only.
          return isBayArea(r.title) || isBayAreaSource(r.link_url);
        })
        .map(toArticle),
    )
      .filter((a) => a.category !== CINEMA_SLUG)
      .slice(0, limit);

  }


  const articles = dedupeArticles(rows.map(toArticle));
  if (category === "cinema") {
    // No picture, no cinema story — there is plenty of illustrated film news.
    return articles
      .filter((a) => a.category === "cinema" && a.image)
      .slice(0, limit);
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
