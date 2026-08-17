import { createServerFn } from "@tanstack/react-start";
import type { Article, DirectoryEntry } from "./content";

/**
 * Content server functions.
 *
 * The site reads exclusively from its own store (Lovable Cloud). There is no
 * external publisher dependency: no remote CMS fetch happens at request time,
 * and nothing is served from a committed third-party snapshot.
 */

/** Own-store reads never take the whole page down. */
async function ownStore<T>(read: () => Promise<T>, empty: T): Promise<T> {
  try {
    return await read();
  } catch (err) {
    console.error("Content store read failed:", err);
    return empty;
  }
}

export const listPosts = createServerFn({ method: "GET" })
  .inputValidator(
    (input: { category?: string; perPage?: number; compact?: boolean; page?: number }) => ({
      category: input?.category,
      perPage: Math.min(Math.max(input?.perPage ?? 12, 1), 48),
      compact: input?.compact === true,
      // Which window of the desk to read: the Glamour slots walk through the
      // whole folder instead of always re-reading the newest photos.
      page: Math.min(Math.max(Math.trunc(input?.page ?? 0), 0), 20),
    }),
  )
  .handler(async ({ data }): Promise<Article[]> => {
    const { cmsPosts } = await import("./cms-articles.server");
    const posts = await ownStore(
      () => cmsPosts(data.category, data.perPage, data.page),
      [] as Article[],
    );
    return data.compact ? posts.map((post) => ({ ...post, html: "" })) : posts;
  });


export const getPostBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => ({ slug: String(input.slug).slice(0, 200) }))
  .handler(async ({ data }): Promise<Article | null> => {
    const { cmsPost } = await import("./cms-articles.server");
    return ownStore(() => cmsPost(data.slug), null);
  });

export const searchPosts = createServerFn({ method: "GET" })
  .inputValidator((input: { q: string }) => ({ q: String(input?.q ?? "").slice(0, 120) }))
  .handler(async ({ data }): Promise<Article[]> => {
    if (!data.q.trim()) return [];
    const { cmsSearch } = await import("./cms-articles.server");
    return ownStore(() => cmsSearch(data.q), [] as Article[]);
  });

export const listDirectory = createServerFn({ method: "GET" }).handler(
  async (): Promise<DirectoryEntry[]> => {
    const { cmsDirectory } = await import("./cms-directory.server");
    return ownStore(() => cmsDirectory(), [] as DirectoryEntry[]);
  },
);
