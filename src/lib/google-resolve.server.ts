/**
 * Google News redirect resolution.
 *
 * Google News RSS links point at news.google.com wrappers. This follows the
 * redirect chain (HEAD, then GET when the host rejects HEAD) and returns the
 * final publisher URL. Results are cached in `url_resolutions` so the same
 * wrapper is never fetched twice, across runs.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const TIMEOUT_MS = 5_000;
const MAX_HOPS = 3;
export const RESOLVE_CONCURRENCY = 8;

export type Resolution = { url: string; unresolved: boolean };

export function isGoogleNewsLink(url: string): boolean {
  try {
    return /(^|\.)news\.google\.com$/.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Process-local memo so one run never repeats a lookup. */
const memo = new Map<string, string>();

async function hop(url: string, method: "HEAD" | "GET"): Promise<Response | null> {
  try {
    return await fetch(url, {
      method,
      redirect: "manual",
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return null;
  }
}

/**
 * Follow up to MAX_HOPS redirects. Returns the original URL with
 * `unresolved: true` when the chain never leaves news.google.com.
 */
export async function resolveGoogleNewsUrl(url: string): Promise<Resolution> {
  if (!isGoogleNewsLink(url)) return { url, unresolved: false };
  const cached = memo.get(url);
  if (cached) return { url: cached, unresolved: false };

  let current = url;
  for (let i = 0; i < MAX_HOPS; i++) {
    let res = await hop(current, "HEAD");
    if (res && res.status === 405) res = await hop(current, "GET");
    if (!res) break;
    const location = res.headers.get("location");
    if (!location) break;
    try {
      current = new URL(location, current).toString();
    } catch {
      break;
    }
    if (!isGoogleNewsLink(current)) {
      memo.set(url, current);
      return { url: current, unresolved: false };
    }
  }
  return { url, unresolved: true };
}

type CacheRow = { google_url: string; resolved_url: string | null };

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/**
 * Resolve a batch of wrapper links with concurrency 8, reading and writing the
 * `url_resolutions` cache. Returns a map of wrapper URL -> resolution.
 */
export async function resolveGoogleNewsLinks(
  urls: string[],
): Promise<Map<string, Resolution>> {
  const out = new Map<string, Resolution>();
  const targets = [...new Set(urls.filter((u) => u && isGoogleNewsLink(u)))];
  if (!targets.length) return out;

  let client: Awaited<ReturnType<typeof db>> | null = null;
  try {
    client = await db();
  } catch {
    client = null;
  }

  const todo: string[] = [];
  if (client) {
    try {
      const { data } = await client
        .from("url_resolutions")
        .select("google_url, resolved_url")
        .in("google_url", targets);
      const cached = new Map(
        ((data ?? []) as CacheRow[]).map((r) => [r.google_url, r.resolved_url]),
      );
      for (const u of targets) {
        const hit = cached.get(u);
        if (hit) out.set(u, { url: hit, unresolved: false });
        else todo.push(u);
      }
    } catch {
      todo.push(...targets);
    }
  } else {
    todo.push(...targets);
  }

  const queue = [...todo];
  const workers = Array.from({ length: Math.min(RESOLVE_CONCURRENCY, queue.length) }, async () => {
    for (;;) {
      const next = queue.shift();
      if (!next) return;
      out.set(next, await resolveGoogleNewsUrl(next));
    }
  });
  await Promise.all(workers);

  if (client) {
    const rows = todo
      .map((u) => out.get(u))
      .map((res, i) => ({ google_url: todo[i]!, resolved_url: res?.url ?? null, res }))
      .filter((r) => r.res && !r.res.unresolved)
      .map(({ google_url, resolved_url }) => ({
        google_url,
        resolved_url,
        resolved_at: new Date().toISOString(),
      }));
    if (rows.length) {
      try {
        await client.from("url_resolutions").upsert(rows, { onConflict: "google_url" });
      } catch {
        /* cache write is best-effort */
      }
    }
  }

  return out;
}
