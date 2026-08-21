import { queryOptions } from "@tanstack/react-query";
import { listPosts } from "@/lib/content.functions";
import { newsRefreshMs } from "@/components/refresh-news";
import { uniqueByContent } from "@/lib/dedupe";
import type { Article } from "@/lib/content";

/** Desks that turn over quickly enough to warrant polling and a refresh control. */
export const LIVE_DESKS = ["city-news", "india-news", "cinema", "micro-drama"];

export const postsQuery = (category: string) =>
  queryOptions({
    // Gallery is a picture desk: show a much deeper set so repeat visits keep
    // finding different photos instead of the same newest handful.
    queryKey: ["wp", "posts", category],
    queryFn: () => listPosts({ data: { category, perPage: category === "gallery" ? 60 : 24 } }),
    // Fast-moving desks poll in the background (city/India 15 min, cinema and
    // micro-drama 30 min) and re-read when a parked tab is focused again.
    staleTime: 5 * 60 * 1000,
    refetchInterval: newsRefreshMs(category),
    refetchOnWindowFocus: true,
    ...(category === "gallery" ? { staleTime: 60_000, refetchOnMount: "always" as const } : {}),
  });

/**
 * City News reads as a Bay Area scroll, but a pure local feed goes stale fast:
 * one Cinema/OTT or India story is folded in after every third city story so the
 * scroll stays varied without losing its local lead.
 */
export function mixInto(local: Article[], guests: Article[], every = 3): Article[] {
  const seen = new Set<string>();
  const base = uniqueByContent(local, seen);
  if (!guests.length) return base;
  const queue = uniqueByContent(guests, seen).filter((a) => !base.some((b) => b.slug === a.slug));
  const out: Article[] = [];
  let g = 0;
  base.forEach((a, i) => {
    out.push(a);
    if ((i + 1) % every === 0 && g < queue.length) out.push(queue[g++]!);
  });
  return out;
}
