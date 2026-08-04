import { createServerFn } from "@tanstack/react-start";
import { POLITICS_REGIONS } from "@/lib/politics-sources";

export type PoliticsStoryDTO = {
  sourceId: string;
  place: string;
  region: string;
  scope: "local" | "india";
  title: string;
  publisher: string;
  url: string;
  date: string | null;
};

export type PoliticsGroupDTO = {
  id: string;
  place: string;
  region: string;
  scope: "local" | "india";
  stories: PoliticsStoryDTO[];
};

const TTL_MS = 3 * 60 * 60 * 1000;
let cache: { at: number; value: PoliticsGroupDTO[] } | null = null;
let refreshing: Promise<void> | null = null;

/** Clears the politics cache so the next read re-pulls every feed. */
export function clearPoliticsCache() {
  const had = cache !== null;
  cache = null;
  return had;
}

function order(groups: PoliticsGroupDTO[]) {
  return [...groups].sort(
    (a, b) => POLITICS_REGIONS.indexOf(a.region) - POLITICS_REGIONS.indexOf(b.region),
  );
}

/**
 * City-hall politics for the 16 Bay Area cities plus Telugu-state, national
 * Indian and Indian-American political news. Cached for three hours; an
 * outage on one feed simply drops that group for the cycle.
 */
export const listPolitics = createServerFn({ method: "GET" }).handler(
  async (): Promise<PoliticsGroupDTO[]> => {
    if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
    // Feeds refresh in the background; readers get the last good pull at once.
    void refreshPolitics();
    return cache?.value ?? [];
  },
);

function refreshPolitics(): Promise<void> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const { fetchAllPolitics } = await import("./politics.server");
      const results = await fetchAllPolitics();
      const groups = order(
        results
          .filter((r) => r.stories.length > 0)
          .map((r) => ({
            id: r.source.id,
            place: r.source.name,
            region: r.source.region,
            scope: r.source.scope,
            stories: r.stories,
          })),
      );
      // Keep the previous good pull if every feed failed this cycle.
      if (groups.length > 0 || !cache) cache = { at: Date.now(), value: groups };
    } catch (err) {
      console.error("politics pull failed", err);
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}