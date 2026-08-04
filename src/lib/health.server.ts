/**
 * Live probes for every ingestion source the site depends on.
 * Server-only: never import this from a route or component.
 */
import { TEMPLE_SOURCES } from "@/lib/temple-sources";
import { POLITICS_SOURCES } from "@/lib/politics-sources";
import { snapshot as wpSnapshot } from "@/lib/wp-snapshot";
import templeSnapshot from "@/content/temple-snapshot.json";

export type Probe = {
  id: string;
  name: string;
  group: "Temples" | "Politics" | "Syndication";
  url: string;
  ok: boolean;
  status: number | null;
  ms: number;
  note: string | null;
};

export type SnapshotHealth = {
  id: string;
  label: string;
  generatedAt: string | null;
  items: number;
};

export type StoreHealth = {
  status: string;
  count: number;
};

export type HealthReport = {
  checkedAt: string;
  probes: Probe[];
  snapshots: SnapshotHealth[];
  store: StoreHealth[];
  storeError: string | null;
};

const TIMEOUT_MS = 8000;

async function probe(
  id: string,
  name: string,
  group: Probe["group"],
  url: string,
): Promise<Probe> {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: { Accept: "*/*", "User-Agent": "BayAreaTeluguTimes/health" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await res.text().catch(() => "");
    return {
      id,
      name,
      group,
      url,
      ok: res.ok && body.length > 200,
      status: res.status,
      ms: Date.now() - started,
      note: res.ok && body.length <= 200 ? "Responded but returned almost no content" : null,
    };
  } catch (err) {
    return {
      id,
      name,
      group,
      url,
      ok: false,
      status: null,
      ms: Date.now() - started,
      note: err instanceof Error ? err.message : "Request failed",
    };
  }
}

/** Runs every probe in parallel and reads snapshot + store freshness. */
export async function buildHealthReport(): Promise<HealthReport> {
  const tasks: Promise<Probe>[] = [
    probe(
      "wp",
      "WordPress syndication",
      "Syndication",
      "https://bayarea.telugutimes.net/wp-json/wp/v2/posts?per_page=1",
    ),
    ...TEMPLE_SOURCES.map((t) =>
      probe(t.id, `${t.name} — ${t.city}`, "Temples", t.feeds[0]?.url ?? t.site),
    ),
    ...POLITICS_SOURCES.map((p) => probe(p.id, `${p.name} (${p.region})`, "Politics", p.url)),
  ];
  const probes = await Promise.all(tasks);

  const temples = templeSnapshot as {
    generatedAt: string;
    temples: { announcements: unknown[] }[];
  };
  const snapshots: SnapshotHealth[] = [
    {
      id: "temples",
      label: "Temple announcements snapshot",
      generatedAt: temples.generatedAt ?? null,
      items: temples.temples.reduce((n, t) => n + t.announcements.length, 0),
    },
    {
      id: "wp",
      label: "Article + directory snapshot",
      generatedAt: wpSnapshot.generatedAt ?? null,
      items: wpSnapshot.posts.length + wpSnapshot.directory.length,
    },
  ];

  let store: StoreHealth[] = [];
  let storeError: string | null = null;
  try {
    const { admin } = await import("@/lib/cms.server");
    const db = await admin();
    const statuses = ["published", "pending", "duplicate", "removed"];
    store = await Promise.all(
      statuses.map(async (status) => {
        const { count } = await db
          .from("content_items")
          .select("id", { count: "exact", head: true })
          .eq("status", status);
        return { status, count: count ?? 0 };
      }),
    );
  } catch (err) {
    storeError = err instanceof Error ? err.message : "Content store unreachable";
  }

  return { checkedAt: new Date().toISOString(), probes, snapshots, store, storeError };
}