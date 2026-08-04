/**
 * Builds a committed content snapshot from WordPress so the site never depends
 * on /wp-json being reachable at request time.
 *
 *   bun scripts/snapshot-wp.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import { toArticle, toDirectoryEntry, type WpPost } from "../src/lib/wp-transform";
import type { Article, DirectoryEntry } from "../src/lib/wp";

const WP = "https://bayarea.telugutimes.net/wp-json/wp/v2";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${WP}${path}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

async function allPosts(): Promise<Article[]> {
  const out: Article[] = [];
  for (let page = 1; page <= 20; page++) {
    const batch = await get<WpPost[]>(
      `/posts?per_page=50&page=${page}&_embed=1&orderby=date&order=desc`,
    ).catch(() => [] as WpPost[]);
    if (batch.length === 0) break;
    out.push(...batch.map(toArticle));
    if (batch.length < 50) break;
  }
  return out;
}

async function directory(): Promise<DirectoryEntry[]> {
  const items = await get<WpPost[]>(`/directory?per_page=40&_embed=1`).catch(
    () => [] as WpPost[],
  );
  return items.map(toDirectoryEntry);
}

const snapshot = {
  generatedAt: new Date().toISOString(),
  posts: await allPosts(),
  directory: await directory(),
};

await mkdir("src/content", { recursive: true });
await writeFile("src/content/wp-snapshot.json", JSON.stringify(snapshot));
console.log(
  `snapshot: ${snapshot.posts.length} posts, ${snapshot.directory.length} directory entries`,
);