import { createServerFn } from "@tanstack/react-start";
import { dedupeBy } from "@/lib/dedupe";
import type { Article, DirectoryEntry } from "./wp";
import { toArticle, toDirectoryEntry, type WpPost } from "./wp-transform";
import {
  snapshotDirectory,
  snapshotPost,
  snapshotPosts,
  snapshotSearch,
} from "./wp-snapshot";
import { wpCache as cache, TTL_MS } from "./wp-cache";

const WP = "https://bayarea.telugutimes.net/wp-json/wp/v2";
const TIMEOUT_MS = 4000;

/**
 * WordPress is an optional syndication feed, not the backend. Set
 * WP_SOURCE=off to run the site entirely on its own store + snapshot.
 */
function wpEnabled() {
  return (process.env["WP_SOURCE"] ?? "on").toLowerCase() !== "off";
}

/** Merge sources, newest first, without repeating the same headline. */
function mergeArticles(...lists: Article[][]): Article[] {
  const seen = new Set<string>();
  const out: Article[] = [];
  for (const list of lists) {
    for (const a of list) {
      const key = a.title.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(a);
    }
  }
  return out;
}

/** Own-store reads never take the whole page down. */
async function ownStore<T>(read: () => Promise<T>, empty: T): Promise<T> {
  try {
    return await read();
  } catch (err) {
    console.error("Content store read failed:", err);
    return empty;
  }
}

/**
 * Reads live WordPress data, but never lets it be a single point of failure:
 * cached response -> live fetch (5s timeout) -> committed content snapshot.
 */
async function resilient<T>(key: string, live: () => Promise<T>, fallback: () => T): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  if (!wpEnabled()) return fallback();
  try {
    const value = await live();
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (err) {
    console.error(`WordPress unavailable for ${key}, serving snapshot:`, err);
    if (hit) return hit.value as T;
    return fallback();
  }
}

async function wpFetch(path: string) {
  const res = await fetch(`${WP}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`WordPress request failed [${res.status}]`);
  }
  return res;
}

export const listPosts = createServerFn({ method: "GET" })
  .inputValidator((input: { category?: string; perPage?: number; instant?: boolean; compact?: boolean }) => ({
    category: input?.category,
    perPage: Math.min(Math.max(input?.perPage ?? 12, 1), 40),
    instant: input?.instant === true,
    compact: input?.compact === true,
  }))
  .handler(async ({ data }): Promise<Article[]> =>
    (async () => {
      // The homepage must never wait on a database or remote publisher. Its
      // committed snapshot is refreshed by ingestion and is available in the
      // worker immediately, including on a cold start.
      if (data.instant) {
        const posts = snapshotPosts(data.category, data.perPage);
        return data.compact ? posts.map((post) => ({ ...post, html: "" })) : posts;
      }
      const { cmsPosts } = await import("./cms-articles.server");
      const own = await ownStore(() => cmsPosts(data.category, data.perPage), [] as Article[]);
      if (own.length >= data.perPage) return own;
      const syndicated = await resilient(
        `posts:${data.category ?? "all"}:${data.perPage}`,
        async () => {
        let query = `?per_page=${data.perPage}&_embed=1&orderby=date&order=desc`;
        if (data.category) {
          const catRes = await wpFetch(
            `/categories?slug=${encodeURIComponent(data.category)}&_fields=id`,
          );
          const cats = (await catRes.json()) as Array<{ id: number }>;
          if (cats.length === 0) return snapshotPosts(data.category, data.perPage);
          query += `&categories=${cats[0]!.id}`;
        }
        const res = await wpFetch(`/posts${query}`);
        const posts = ((await res.json()) as WpPost[]).map(toArticle);
        return posts.length > 0 ? posts : snapshotPosts(data.category, data.perPage);
        },
        () => snapshotPosts(data.category, data.perPage),
      );
      return mergeArticles(own, syndicated).slice(0, data.perPage);
    })(),
  );

export const getPostBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => ({ slug: String(input.slug).slice(0, 200) }))
  .handler(async ({ data }): Promise<Article | null> =>
    (await (async () => {
      const { cmsPost } = await import("./cms-articles.server");
      const own = await ownStore(() => cmsPost(data.slug), null);
      if (own) return own;
      return resilient(
      `post:${data.slug}`,
      async () => {
        const res = await wpFetch(`/posts?slug=${encodeURIComponent(data.slug)}&_embed=1`);
        const posts = (await res.json()) as WpPost[];
        return posts[0] ? toArticle(posts[0]) : snapshotPost(data.slug);
      },
      () => snapshotPost(data.slug),
      );
    })()),
  );

export const searchPosts = createServerFn({ method: "GET" })
  .inputValidator((input: { q: string }) => ({ q: String(input?.q ?? "").slice(0, 120) }))
  .handler(async ({ data }): Promise<Article[]> => {
    if (!data.q.trim()) return [];
    const { cmsSearch } = await import("./cms-articles.server");
    const own = await ownStore(() => cmsSearch(data.q), [] as Article[]);
    const syndicated = await resilient(
      `search:${data.q.toLowerCase()}`,
      async () => {
        const res = await wpFetch(
          `/posts?search=${encodeURIComponent(data.q)}&per_page=20&_embed=1`,
        );
        return ((await res.json()) as WpPost[]).map(toArticle);
      },
      () => snapshotSearch(data.q),
    );
    return mergeArticles(own, syndicated).slice(0, 20);
  });

export const listDirectory = createServerFn({ method: "GET" }).handler(
  async (): Promise<DirectoryEntry[]> =>
    resilient(
      "directory",
      async () => {
        // WordPress holds ~66 listings across Super Markets, Restaurants,
        // Hindu Temples and Cinema Theatres — pull the whole set, not one page.
        const res = await wpFetch(`/directory?per_page=100&_embed=1`);
        const items = ((await res.json()) as WpPost[]).map(toDirectoryEntry);
        return items.length > 0 ? mergeDirectoryDuplicates(items) : snapshotDirectory();
      },
      () => mergeDirectoryDuplicates(snapshotDirectory()),
    ),
);

/**
 * WordPress carries several listings per business (SAFEWAY x5, Trader Joe's
 * x3). Show one card per business and keep the extra slugs on the entry so the
 * newsroom can see what was merged.
 */
function mergeDirectoryDuplicates(items: DirectoryEntry[]): DirectoryEntry[] {
  const { unique, duplicates } = dedupeBy(items, (e) => `${e.title} ${e.category ?? ""}`);
  const extras = new Map(duplicates.map((d) => [d.kept.id, d.dropped.map((x) => x.slug)]));
  return unique.map((e) => {
    const dupes = extras.get(e.id);
    return dupes ? { ...e, duplicates: dupes } : e;
  });
}
