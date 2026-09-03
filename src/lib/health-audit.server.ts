/**
 * Ingest self-audit.
 *
 * Answers one question every morning: is anything quietly dead? It reads the
 * newest article per section, the per-source outcomes in `ingest_runs`, and
 * whether each scheduled job fired in the last 24 hours. Anything flagged is
 * retried once and then pushed to the phone; a healthy audit sends nothing.
 *
 * Server-only.
 */
import { sendPushover, MAX_BODY } from "./pushover.server";
import { INDIA_FEEDS, QUIET_SOURCES } from "./india-ingest.server";

const SITE = "https://project--21d2eeed-01e3-4e0e-a028-88e01859acea.lovable.app";

/** Sections a reader can land on that must never go quiet. */
export const WATCHED_CATEGORIES = [
  "news",
  "india-national",
  "india-telangana",
  "india-andhra",
  "india-immigration",
  "india-nri",
  "cinema",
  "gallery",
  "events",
  "temples",
] as const;

/** Scheduled jobs and the hook each one calls, used for the missed-run retry. */
export const SCHEDULED_JOBS: { mode: string; path: string; body: unknown }[] = [
  { mode: "all", path: "/api/public/hooks/collect-news", body: { trigger: "cron" } },
  { mode: "gallery", path: "/api/public/hooks/collect-news", body: { mode: "gallery" } },
  { mode: "india", path: "/api/public/hooks/india-ingest", body: { trigger: "cron" } },
];

export type CategoryHealth = {
  category: string;
  newest: string | null;
  hoursSince: number | null;
  stale: boolean;
};

export type SourceHealth = {
  source: string;
  lastSuccess: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  consecutiveFailures: number;
  items72h: number;
  items7d: number;
  flagged: boolean;
};

/** Latest per-publisher fetch outcome, read from the newest collect run funnels. */
export type FeedHealth = {
  source: string;
  lastFetchAt: string | null;
  fetched: number;
  kept: number;
  withImage: number;
  zeroItems: boolean;
  usedFallback: boolean;
  error: string | null;
  runMode: string | null;
  runFinishedAt: string | null;
};

export type IngestHealthReport = {
  checkedAt: string;
  categories: CategoryHealth[];
  sources: SourceHealth[];
  feeds: FeedHealth[];
  jobs: { mode: string; lastRun: string | null; firedInLast24h: boolean }[];
  issues: { kind: "category" | "source" | "job" | "alerts" | "feed"; text: string; priority: 0 | 1 }[];
};

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const hoursSince = (iso: string | null) =>
  iso ? Math.round(((Date.now() - Date.parse(iso)) / 3_600_000) * 10) / 10 : null;

/** Newest published article per watched section. */
async function categoryHealth(): Promise<CategoryHealth[]> {
  const client = await db();
  const out: CategoryHealth[] = [];
  for (const category of WATCHED_CATEGORIES) {
    const { data } = await client
      .from("content_items")
      .select("published_at")
      .eq("status", "published")
      .eq("resolved_category", category)
      .order("published_at", { ascending: false })
      .limit(1);
    const newest = (data ?? [])[0]?.published_at ?? null;
    const hrs = hoursSince(newest);
    out.push({
      category,
      newest,
      hoursSince: hrs,
      stale: hrs === null || hrs > 48,
    });
  }
  return out;
}

/** Per-source outcomes from the last 7 days of ingest runs. */
async function sourceHealth(): Promise<SourceHealth[]> {
  const client = await db();
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data } = await client
    .from("ingest_runs")
    .select("source, status, items_inserted, error, finished_at")
    .gte("finished_at", since)
    .order("finished_at", { ascending: false })
    .limit(4000);
  const rows = (data ?? []) as {
    source: string;
    status: string;
    items_inserted: number;
    error: string | null;
    finished_at: string;
  }[];

  const registered = new Set(INDIA_FEEDS.map((f) => f.name));
  const names = new Set<string>([...registered, ...rows.map((r) => r.source)]);
  const out: SourceHealth[] = [];
  for (const source of names) {
    if (source.startsWith("pushover")) continue;
    const mine = rows.filter((r) => r.source === source);
    const lastSuccess = mine.find((r) => r.status === "ok")?.finished_at ?? null;
    const lastFailure = mine.find((r) => r.status === "failed");
    let consecutiveFailures = 0;
    for (const r of mine) {
      if (r.status === "failed") consecutiveFailures += 1;
      else break;
    }
    const items72h = mine
      .filter((r) => Date.parse(r.finished_at) > Date.now() - 72 * 3_600_000)
      .reduce((n, r) => n + (r.items_inserted ?? 0), 0);
    const items7d = mine.reduce((n, r) => n + (r.items_inserted ?? 0), 0);
    const ranIn72h = mine.some((r) => Date.parse(r.finished_at) > Date.now() - 72 * 3_600_000);
    // A source that was retired from the registry keeps its history on the page
    // but must not raise an alert about a feed nobody reads any more.
    const live = registered.has(source);
    out.push({
      source,
      lastSuccess,
      lastError: lastFailure?.error ?? null,
      lastErrorAt: lastFailure?.finished_at ?? null,
      consecutiveFailures,
      items72h,
      items7d,
      flagged:
        live &&
        (consecutiveFailures >= 3 ||
          (ranIn72h && items72h === 0 && !QUIET_SOURCES.has(source))),
    });
  }

  return out.sort((a, b) => a.items7d - b.items7d);
}

/**
 * Latest fetch result per publisher feed. The collector already records
 * requests / returned / kept / errors per source in `collect_runs.funnel`, so
 * the desk reads the newest run that mentions each feed rather than guessing
 * from insert counts (a source can fetch fine and still insert nothing).
 */
async function feedHealth(): Promise<FeedHealth[]> {
  const client = await db();
  const { data } = await client
    .from("collect_runs")
    .select("mode, finished_at, started_at, funnel")
    .order("started_at", { ascending: false })
    .limit(40);

  type PublisherStat = {
    requests?: number;
    returned?: number;
    kept?: number;
    withImage?: number;
    itemsFetched?: number;
    lastFetchAt?: string;
    error?: string;
    usedFallback?: boolean;
  };

  const byFeed = new Map<string, FeedHealth>();
  for (const run of (data ?? []) as {
    mode: string | null;
    finished_at: string | null;
    started_at: string | null;
    funnel: unknown;
  }[]) {
    const publishers = (run.funnel as { publishers?: { bySource?: Record<string, PublisherStat> } } | null)
      ?.publishers?.bySource;
    if (!publishers) continue;
    for (const [source, stat] of Object.entries(publishers)) {
      // Runs are newest-first, so the first sighting of a feed is its latest.
      if (byFeed.has(source)) continue;
      const fetched = stat.itemsFetched ?? stat.returned ?? 0;
      byFeed.set(source, {
        source,
        lastFetchAt: stat.lastFetchAt ?? run.finished_at ?? run.started_at ?? null,
        fetched,
        kept: stat.kept ?? 0,
        withImage: stat.withImage ?? 0,
        zeroItems: fetched === 0,
        usedFallback: !!stat.usedFallback,
        error: stat.error ?? null,
        runMode: run.mode ?? null,
        runFinishedAt: run.finished_at ?? null,
      });
    }
  }

  // Zero-item feeds first: that is the list the editor needs to act on.
  return [...byFeed.values()].sort(
    (a, b) => Number(b.zeroItems) - Number(a.zeroItems) || a.fetched - b.fetched,
  );
}

/** Did each scheduled job fire in the last 24 hours? */
async function jobHealth() {
  const client = await db();
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const out: IngestHealthReport["jobs"] = [];
  for (const job of SCHEDULED_JOBS) {
    let lastRun: string | null = null;
    if (job.mode === "india") {
      const { data } = await client
        .from("ingest_runs")
        .select("finished_at")
        .eq("mode", "india")
        .order("finished_at", { ascending: false })
        .limit(1);
      lastRun = (data ?? [])[0]?.finished_at ?? null;
    } else {
      const { data } = await client
        .from("collect_runs")
        .select("finished_at")
        .eq("mode", job.mode)
        .order("finished_at", { ascending: false })
        .limit(1);
      lastRun = (data ?? [])[0]?.finished_at ?? null;
    }
    out.push({
      mode: job.mode,
      lastRun,
      firedInLast24h: !!lastRun && lastRun >= since,
    });
  }
  return out;
}

/** Calls a hook once, with the shared ingest token. */
async function retryJob(job: (typeof SCHEDULED_JOBS)[number]): Promise<string> {
  try {
    const client = await db();
    const { data } = await client.from("hook_tokens").select("token").eq("name", "ingest").limit(1);
    const token = (data ?? [])[0]?.token;
    if (!token) return "no hook token";
    const res = await fetch(`${SITE}${job.path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...(job.body as object), trigger: "retry" }),
      signal: AbortSignal.timeout(110_000),
    });
    return `HTTP ${res.status}`;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

export async function buildIngestHealth(): Promise<IngestHealthReport> {
  const [categories, sources, feeds, jobs] = await Promise.all([
    categoryHealth(),
    sourceHealth(),
    feedHealth(),
    jobHealth(),
  ]);

  const issues: IngestHealthReport["issues"] = [];
  for (const c of categories.filter((c) => c.stale)) {
    issues.push({
      kind: "category",
      text: `${c.category}: no new story for ${c.hoursSince ?? "?"}h`,
      priority: 1,
    });
  }
  for (const s of sources.filter((s) => s.flagged)) {
    issues.push({
      kind: "source",
      text: `${s.source}: ${s.consecutiveFailures >= 3 ? `${s.consecutiveFailures} failures in a row` : "0 items in 72h"}${s.lastError ? ` — ${s.lastError.slice(0, 80)}` : ""}`,
      priority: 0,
    });
  }
  for (const j of jobs.filter((j) => !j.firedInLast24h)) {
    issues.push({
      kind: "job",
      text: `job "${j.mode}" has not run in 24h (last ${j.lastRun ?? "never"})`,
      priority: 0,
    });
  }
  // Feeds that answered but returned nothing: the single most common reason the
  // digest thins out, and invisible in insert counts.
  const dead = feeds.filter((f) => f.zeroItems);
  if (dead.length) {
    issues.push({
      kind: "feed",
      text: `${dead.length} feed(s) returned 0 items on their latest fetch: ${dead
        .slice(0, 6)
        .map((f) => `${f.source}${f.error ? ` (${f.error.slice(0, 40)})` : ""}`)
        .join("; ")}`,
      priority: 0,
    });
  }

  // A broken alert channel is itself an issue worth showing on the page.
  const client = await db();
  const { data: alertRows } = await client
    .from("ingest_runs")
    .select("error, finished_at")
    .eq("mode", "pushover")
    .eq("status", "failed")
    .gte("finished_at", new Date(Date.now() - 48 * 3_600_000).toISOString())
    .order("finished_at", { ascending: false })
    .limit(1);
  const alertFail = (alertRows ?? [])[0];
  if (alertFail) {
    issues.push({
      kind: "alerts",
      text: `Pushover delivery failed: ${String(alertFail.error ?? "").slice(0, 120)}`,
      priority: 0,
    });
  }

  return {
    checkedAt: new Date().toISOString(),
    categories,
    sources,
    feeds,
    jobs,
    issues,
  };
}

/** Daily audit: retry what missed its schedule, then alert only if flagged. */
export async function runDailyAudit(): Promise<{
  report: IngestHealthReport;
  retried: { mode: string; result: string }[];
  notified: boolean;
  pushover: { ok: boolean; status: number } | null;
}> {
  const first = await buildIngestHealth();
  const retried: { mode: string; result: string }[] = [];
  for (const job of first.jobs.filter((j) => !j.firedInLast24h)) {
    const target = SCHEDULED_JOBS.find((s) => s.mode === job.mode);
    if (!target) continue;
    retried.push({ mode: job.mode, result: await retryJob(target) });
  }

  const report = retried.length ? await buildIngestHealth() : first;
  if (!report.issues.length) return { report, retried, notified: false, pushover: null };

  const top = report.issues.slice(0, 5);
  let body = report.issues.map((i) => `• ${i.text}`).join("\n");
  if (body.length > MAX_BODY) {
    body = `${top.map((i) => `• ${i.text}`).join("\n")}\nMore at /admin/health`;
  }
  const priority = report.issues.some((i) => i.priority === 1) ? 1 : 0;
  const push = await sendPushover({ title: "TBA ingest alert", message: body, priority });
  return { report, retried, notified: true, pushover: { ok: push.ok, status: push.status } };
}

/** Monday digest: items ingested per source over 7 days, weakest first. */
export async function runWeeklyDigest(): Promise<{ sent: boolean; status: number }> {
  const sources = (await sourceHealth()).filter((s) => !s.source.startsWith("pushover"));
  const lines = sources.map((s) => `${s.source}: ${s.items7d}`);
  let body = lines.join("\n");
  if (body.length > MAX_BODY) body = `${lines.slice(0, 20).join("\n")}\nMore at /admin/health`;
  const push = await sendPushover({
    title: "TBA weekly ingest",
    message: body || "No ingest activity recorded in the last 7 days.",
    priority: 0,
  });
  return { sent: push.ok, status: push.status };
}
