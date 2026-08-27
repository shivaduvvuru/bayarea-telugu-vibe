/**
 * Reads the site's own content store (Lovable Cloud) as Article DTOs.
 *
 * This is the only content source: the site has no external publisher feed.
 */
import type { Article } from "./content";
import { categoryBySlug, CITY_CATEGORIES } from "./content";
import { isBayArea, isBayAreaSource } from "./bay-area";
import { publicClient } from "./cms.server";
import { sanitizeHtml, decode } from "./sanitize";
import { galleryImage, sourceLabel, usableImage } from "./story-image";
import { classifyIndia, INDIA_SLUGS } from "./india-topics";
import { isCinema, isStarGallery, CINEMA_SLUG } from "./cinema-topics";
import { isMicroDrama, MICRO_DRAMA_SLUG } from "./microdrama-topics";
import { uniqueByContent } from "./dedupe";
import { isTempleNewsClean } from "./temple-purity";
import { glamourRotation } from "./glamour-rotation";

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

/**
 * India and Cinema/OTT are rolling desks: readers should see today's coverage,
 * not a week-old page that never turns over. Stories from the last few days
 * lead, and older items only fill in when the fresh set is short.
 */
function freshestFirst(items: Article[], limit: number, hours = 72): Article[] {
  const cutoff = Date.now() - hours * 3_600_000;
  const fresh = items.filter((a) => new Date(a.date).getTime() >= cutoff);
  if (fresh.length >= limit) return fresh.slice(0, limit);
  const older = items.filter((a) => new Date(a.date).getTime() < cutoff);
  return [...fresh, ...older].slice(0, limit);
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
  body?: string | null;
  image_url: string | null;
  link_url: string | null;
  city: string | null;
  category: string | null;
  published_at: string | null;
  created_at: string;
  source?: string | null;
  resolved_category?: string | null;
  is_local?: boolean | null;
  /** When a reader was last shown this picture (Glamour rotation only). */
  last_shown_at?: string | null;
};

/**
 * Feed/list reads deliberately omit `body`: cards only render the headline,
 * excerpt and artwork, so transferring (and sanitising) full article HTML for
 * hundreds of rows was pure waste. The article page reads `body` on its own.
 */
const LIST_COLUMNS =
  "id, title, summary, image_url, link_url, city, category, published_at, created_at, source, resolved_category, is_local, last_shown_at";

const DETAIL_COLUMNS = `${LIST_COLUMNS}, body`;


/** Minimal escape so a summary can stand in for article HTML on list reads. */
function escapeText(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}


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
  // A stamped row already knows its section; only unstamped (pre-backfill)
  // rows fall back to the classification chain above. Picture-desk rows are
  // stamped "gallery", and those still display under the section the old chain
  // gave them (star photos read as Cinema/OTT) so cards are unchanged.
  const resolved = row.resolved_category ?? null;
  const slug =
    resolved && resolved !== "gallery"
      ? resolved
      : stored === CINEMA_SLUG || stored === MICRO_DRAMA_SLUG
        ? CINEMA_SLUG
        : (citySlugOf(row.city) ?? stored ?? "community");
  const cat = categoryBySlug(slug);
  // Feed text arrives with HTML entities (&#8217; etc.); render real characters.
  const text = decode(row.summary ?? "");
  return {
    id: numericId(row.id),
    slug: cmsSlug(row.id),
    title: decode(row.title ?? ""),
    excerpt: text.slice(0, 300),
    // Sanitising is only needed for stored article HTML (detail reads). List
    // reads have no body, so the excerpt is escaped and wrapped instead.
    html:
      row.body != null
        ? sanitizeHtml(row.body)
        : text
          ? `<p>${escapeText(text)}</p>`
          : "",
    date: row.published_at ?? row.created_at,
    author: "Times Bay Area",
    image: usableImage(row.image_url),
    category: slug,
    categoryName: cat?.en ?? "Community",
    sourceName: sourceLabel(row.link_url),
    sourceUrl: row.link_url,
  };
}

function base(columns: string = LIST_COLUMNS) {
  return publicClient()
    .from("content_items")
    .select(columns)
    .eq("status", "published")
    .neq("placement", "hidden")
    .not("summary", "is", null)
    .neq("summary", "")
    .in("kind", ["news", "announcement", "event"]);
}


/**
 * Short-lived in-process cache for feed reads. Several surfaces on one page
 * (feed + headline hero + hero slides) ask for the same desk, and every
 * anonymous visitor asks for the same thing: recomputing the classification
 * pass each time was the bulk of the server response time. 60 seconds keeps a
 * news feed fresh while collapsing the duplicate work.
 */
const FEED_TTL_MS = 60_000;
/**
 * The Glamour pocket only turns over every 8 hours, so re-reading 900 picture
 * rows every minute was wasted work: gallery feeds cache much longer.
 */
const GALLERY_TTL_MS = 10 * 60_000;
const feedCache = new Map<string, { at: number; ttl: number; posts: Promise<Article[]> }>();

/**
 * Dropped by the publish job, and only when it actually published something,
 * so a tick that finds an empty backlog costs nothing and readers still see
 * new stories on the next request instead of waiting out the TTL.
 */
export function clearFeedCache() {
  feedCache.clear();
}

/** Published stories for a category/city slug (or everything when omitted). */
export function cmsPosts(
  category: string | undefined,
  limit: number,
  page = 0,
): Promise<Article[]> {
  const key = `${category ?? "all"}|${limit}|${page}`;
  const ttl = category === "gallery" ? GALLERY_TTL_MS : FEED_TTL_MS;
  const hit = feedCache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.posts;
  const posts = readPosts(category, limit, page).catch((err) => {
    feedCache.delete(key);
    throw err;
  });
  feedCache.set(key, { at: Date.now(), ttl, posts });
  if (feedCache.size > 40) {
    for (const [k, v] of feedCache) if (Date.now() - v.at > v.ttl) feedCache.delete(k);
  }
  return posts;
}


async function readPosts(
  category: string | undefined,
  limit: number,
  page = 0,
): Promise<Article[]> {
  let q = base().order("published_at", { ascending: false }).limit(limit);

  // Rows published before classification moved to publish time carry no
  // resolved_category. They are read in a second, narrow pass ("legacy") and
  // still go through the old classifier cascade, so nothing disappears during
  // the rollout. Once the backfill reports zero remaining this pass is empty.
  const legacyBase = () => base().is("resolved_category", null);
  let legacyQuery: ReturnType<typeof base> | null = null;

  if (category === "city-news") {
    // Bay Area local reporting only, straight off the partial index.
    q = base()
      .eq("is_local", true)
      .order("published_at", { ascending: false })
      .limit(limit * 2);
    legacyQuery = legacyBase()
      .order("published_at", { ascending: false })
      .limit(200)
      .not("city", "is", null);
  } else if (category === "gallery") {
    // Picture-desk rows (editor picks and star photo features) are stamped
    // "gallery" at publish time, so the desk is one indexed read.
    q = base()
      .eq("resolved_category", "gallery")
      .order("published_at", { ascending: false })
      .limit(300)
      .not("image_url", "is", null);
    legacyQuery = legacyBase()
      .order("published_at", { ascending: false })
      .limit(300)
      .not("image_url", "is", null);
  } else if (category === "cinema") {
    // Film / OTT coverage only. Picture-desk rows live on Glamour, which has
    // its own nav item, so a story appears on exactly one section page.
    q = base()
      .eq("resolved_category", "cinema")
      .order("published_at", { ascending: false })
      .limit(Math.max(limit * 4, 200))
      .not("image_url", "is", null);
    legacyQuery = legacyBase()
      .order("published_at", { ascending: false })
      .limit(200)
      .not("image_url", "is", null)
      .in("category", ["cinema", MICRO_DRAMA_SLUG, "news"]);
  } else if (category === "micro-drama") {
    // Micro-drama lives on the cinema desk; the format check runs on that
    // small stamped set instead of a 600-row scan.
    q = base()
      .in("resolved_category", ["cinema", "gallery", MICRO_DRAMA_SLUG])
      .order("published_at", { ascending: false })
      .limit(Math.max(limit * 10, 300));
    legacyQuery = legacyBase()
      .order("published_at", { ascending: false })
      .limit(200)
      .in("category", [MICRO_DRAMA_SLUG, "cinema", "news"]);
  } else if (category === "india-news") {
    q = base()
      .in("resolved_category", [...INDIA_SLUGS])
      .order("published_at", { ascending: false })
      .limit(limit * 3);
    legacyQuery = legacyBase()
      .order("published_at", { ascending: false })
      .limit(limit * 6)
      .in("category", [...INDIA_SLUGS, "news", "political"]);
  } else if (category) {
    const cityName = cityNameOf(category);
    const clauses = [`category.eq.${category}`, `city.eq.${category}`];
    if (cityName) clauses.push(`city.eq.${cityName}`);
    q = q.or(clauses.join(","));
  }

  // Both reads start now so they run concurrently instead of adding a round trip.
  const legacy = legacyQuery ? Promise.resolve(legacyQuery) : null;
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as unknown as Row[];
  const { data: legacyData } = (await legacy) ?? { data: null };
  const legacyRows = (legacyData ?? []) as unknown as Row[];

  if (category === "gallery") {
    // Stamped rows are already the picture desk; unstamped rows still go
    // through the intake classifier (editor picks bypass it, as before).
    const stamped = rows.filter((r) => galleryImage(r.image_url));
    const fallback = legacyRows.filter(
      (r) =>
        galleryImage(r.image_url) &&
        (r.category === "gallery" || isStarGallery(r.title, r.summary, r.link_url)),
    );
    // Least-recently-shown first, reshuffled every day: pictures nobody has
    // seen lead the folder, then the ones seen longest ago, and the order is
    // never yesterday's order rotated (see glamour-rotation).
    const ordered = glamourRotation([...stamped, ...fallback]);
    // `page` walks a window through the whole picture folder, so a later read
    // returns photos the reader has not been shown yet instead of the same
    // newest batch. Falls back to the first window once the folder runs out.
    const all = dedupeArticles(ordered.map(toArticle));
    const from = page * limit;
    return from < all.length ? all.slice(from, from + limit) : all.slice(0, limit);
  }

  if (category === "india-news") {
    return freshestFirst(
      dedupeArticles(
        [
          ...rows,
          ...legacyRows.filter(
            (r) =>
              INDIA_SLUGS.includes(r.category as (typeof INDIA_SLUGS)[number]) ||
              classifyIndia(r.title, r.summary, r.link_url) !== null,
          ),
        ].map(toArticle),
      ).filter((a) => a.image),
      limit,
    );
  }

  if (category === "micro-drama") {
    const stamped = rows.filter(
      (r) => r.category === MICRO_DRAMA_SLUG || isMicroDrama(r.title, r.summary, r.link_url),
    );
    const fallback = legacyRows.filter(
      (r) => r.category === MICRO_DRAMA_SLUG || isMicroDrama(r.title, r.summary, r.link_url),
    );
    // No picture, no story: text-only items are dropped, not listed.
    const all = dedupeArticles([...stamped, ...fallback].map(toArticle));
    return all.filter((a) => a.image).slice(0, limit);
  }

  if (category === "city-news") {
    // Stamped rows already passed the local test at publish time; only a light
    // residual check remains (a row later reclassified onto a picture desk).
    const stamped = rows.filter(
      (r) =>
        r.resolved_category !== CINEMA_SLUG &&
        r.resolved_category !== MICRO_DRAMA_SLUG &&
        r.resolved_category !== "gallery",
    );
    // Local reporting only: no India coverage and no film/gallery
    // stories (cinema is a topic of its own, even when filed to a city).
    const fallback = legacyRows.filter((r) => {
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
    });
    return dedupeArticles([...stamped, ...fallback].map(toArticle))
      // No picture, no news card: illustrated reporting only.
      .filter((a) => a.category !== CINEMA_SLUG && a.image)
      .slice(0, limit);
  }

  const articles = dedupeArticles([...rows, ...legacyRows].map(toArticle));
  if (category === "cinema") {
    // Artwork is no longer required: imageless cinema items carry the desk
    // placeholder, so a story is never hidden for lacking a picture. A summary
    // is what a card needs. Star photo features belong to Glamour only.
    return freshestFirst(
      articles.filter(
        (a) =>
          a.category === "cinema" &&
          !!a.excerpt &&
          !isStarGallery(a.title, a.excerpt, a.sourceUrl ?? null),
      ),
      limit,
    );
  }
  if (category === "temples") {
    // Temple coverage stays religious, from temple sites or reliable outlets.
    // Temple notices and events are calendar items, so artwork is optional here.
    return articles.filter((a) =>
      isTempleNewsClean({ title: a.title, summary: a.excerpt, sourceUrl: a.sourceUrl ?? null }),
    );
  }
  if (category === "events" || category === "events-community") return articles;

  // Everything else on the news side needs artwork.
  return articles.filter((a) => a.image);
}

export async function cmsPost(slug: string): Promise<Article | null> {
  if (!slug.startsWith("c-")) return null;
  const { data, error } = await base(DETAIL_COLUMNS).eq("id", slug.slice(2)).limit(1).maybeSingle();
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
