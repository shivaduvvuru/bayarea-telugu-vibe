import { createServerFn } from "@tanstack/react-start";
import snapshot from "@/content/temple-snapshot.json";

export type TempleAnnouncementDTO = {
  templeId: string;
  temple: string;
  city: string;
  region: string;
  title: string;
  url: string;
  date: string | null;
};

export type TempleGroupDTO = {
  id: string;
  name: string;
  city: string;
  region: string;
  site: string;
  announcements: TempleAnnouncementDTO[];
};

type Snapshot = { generatedAt: string; temples: (TempleGroupDTO & { ok: boolean })[] };

const TTL_MS = 6 * 60 * 60 * 1000;
let cache: { at: number; value: TempleGroupDTO[] } | null = null;
let refreshing: Promise<void> | null = null;

function fromSnapshot(): TempleGroupDTO[] {
  return (snapshot as Snapshot).temples.map(({ ok: _ok, ...t }) => t);
}

/** Clears the temple cache so the next read re-scrapes every temple site. */
export function clearTempleCache() {
  const had = cache !== null;
  cache = null;
  return had;
}

/**
 * Temple announcements pulled directly from each temple's website.
 * cache -> live scrape (parallel, 8s per site) -> committed snapshot.
 */
export const listTempleAnnouncements = createServerFn({ method: "GET" }).handler(
  async (): Promise<TempleGroupDTO[]> => {
    if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
    // Never make a visitor wait on ~25 live temple-site scrapes: serve the last
    // known data instantly and refresh in the background.
    void refreshTemples();
    return cache?.value ?? fromSnapshot();
  },
);

function refreshTemples(): Promise<void> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const { fetchAllTemples } = await import("./temples.server");
      const results = await fetchAllTemples();
      const live: TempleGroupDTO[] = results.map((r) => ({
        id: r.source.id,
        name: r.source.name,
        city: r.source.city,
        region: r.source.region,
        site: r.source.site,
        announcements: r.announcements,
      }));
      // Any temple whose site was down keeps its last known announcements.
      const fallback = fromSnapshot();
      const merged = live.map((t) =>
        t.announcements.length > 0
          ? t
          : (fallback.find((f) => f.id === t.id) ?? t),
      );
      cache = { at: Date.now(), value: merged };
    } catch (err) {
      console.error("temple pull failed, keeping snapshot:", err);
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}
