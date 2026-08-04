import type { Article, DirectoryEntry } from "./wp";
import snapshotJson from "../content/wp-snapshot.json";

type Snapshot = {
  generatedAt: string;
  posts: Article[];
  directory: DirectoryEntry[];
};

export const snapshot = snapshotJson as Snapshot;

export function snapshotPosts(category: string | undefined, perPage: number): Article[] {
  const list = category
    ? snapshot.posts.filter((p) => p.category === category)
    : snapshot.posts;
  return list.slice(0, perPage);
}

export function snapshotPost(slug: string): Article | null {
  return snapshot.posts.find((p) => p.slug === slug) ?? null;
}

export function snapshotSearch(q: string): Article[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  return snapshot.posts
    .filter(
      (p) =>
        p.title.toLowerCase().includes(needle) ||
        p.excerpt.toLowerCase().includes(needle),
    )
    .slice(0, 20);
}

export function snapshotDirectory(): DirectoryEntry[] {
  return snapshot.directory;
}