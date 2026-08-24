/**
 * Backoff and concurrency helpers shared by the outbound batch callers
 * (Gemini summaries, Overpass slices).
 *
 * Both callers used to fire every request at once with no retry: a single 429
 * from the gateway or a busy Overpass mirror lost the whole batch. These helpers
 * keep the number of in-flight requests bounded and retry the transient
 * failures with exponential backoff plus jitter, logging every wait so the
 * throttling is visible in the run logs instead of showing up as silent
 * slowness.
 *
 * Pure and dependency-free so the ingest tests can drive them directly.
 */

export type RetryStats = {
  /** Requests that waited on the concurrency gate before starting. */
  throttled: number;
  /** Retry attempts made after a transient failure. */
  retries: number;
  /** Total milliseconds spent sleeping in backoff. */
  waitedMs: number;
};

export function newRetryStats(): RetryStats {
  return { throttled: 0, retries: 0, waitedMs: 0 };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Transient by default: rate limits, upstream 5xx, timeouts and network drops. */
export function isTransient(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /\b(429|500|502|503|504)\b|rate.?limit|timeout|timed out|temporarily|busy|network|fetch failed|ECONN|socket/i.test(
    message,
  );
}

export interface RetryOptions {
  /** Total attempts, including the first. */
  attempts?: number;
  /** First backoff delay; doubles per attempt. */
  baseMs?: number;
  /** Upper bound for a single backoff wait. */
  maxMs?: number;
  /** Label used in the throttle/retry log lines. */
  label?: string;
  stats?: RetryStats;
  /** Decides whether a failure is worth retrying. */
  retryable?: (error: unknown) => boolean;
  /** Seconds the caller must wait, when the failure carries a Retry-After. */
  retryAfterMs?: (error: unknown) => number | null;
  log?: (line: string) => void;
}

/**
 * Runs `task`, retrying transient failures with exponential backoff and jitter.
 * A `Retry-After` hint always wins over the computed delay.
 */
export async function withRetry<T>(task: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const attempts = Math.max(1, opts.attempts ?? 3);
  const baseMs = opts.baseMs ?? 800;
  const maxMs = opts.maxMs ?? 15_000;
  const label = opts.label ?? "request";
  const log = opts.log ?? ((line: string) => console.warn(line));
  const retryable = opts.retryable ?? isTransient;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt === attempts || !retryable(error)) break;
      const hinted = opts.retryAfterMs?.(error) ?? null;
      const backoff = Math.min(maxMs, baseMs * 2 ** (attempt - 1));
      const wait = Math.round(hinted ?? backoff * (0.7 + Math.random() * 0.6));
      if (opts.stats) {
        opts.stats.retries += 1;
        opts.stats.waitedMs += wait;
      }
      log(
        `[retry] ${label} attempt ${attempt}/${attempts} failed (${
          error instanceof Error ? error.message : String(error)
        }) — waiting ${wait}ms`,
      );
      await sleep(wait);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * Maps `items` with at most `limit` tasks in flight. Results keep the input
 * order; a task that throws rejects the whole map, exactly like `Promise.all`.
 */
export async function mapWithLimit<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
  opts: { label?: string; stats?: RetryStats; log?: (line: string) => void } = {},
): Promise<R[]> {
  const cap = Math.max(1, Math.min(limit, items.length || 1));
  const out = new Array<R>(items.length);
  let cursor = 0;
  if (items.length > cap) {
    const line = `[throttle] ${opts.label ?? "batch"}: ${items.length} calls capped at ${cap} in flight`;
    (opts.log ?? ((l: string) => console.log(l)))(line);
    if (opts.stats) opts.stats.throttled += items.length - cap;
  }

  const workers = Array.from({ length: cap }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      out[index] = await task(items[index]!, index);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Single-flight gate: caps how many calls to one upstream run at a time. */
export function createGate(limit: number, label = "upstream") {
  const cap = Math.max(1, limit);
  let active = 0;
  const queue: (() => void)[] = [];
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active >= cap) {
      console.log(`[throttle] ${label}: waiting for a slot (${active}/${cap} in flight)`);
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    active += 1;
    try {
      return await task();
    } finally {
      active -= 1;
      queue.shift()?.();
    }
  };
}

/**
 * Client-side flavour used by the review desk: retries every failure (a slow
 * desk response is always worth another attempt) and reports the attempt number
 * so the UI can show "retrying…" instead of an empty queue.
 */
export async function retryWithBackoff<T>(
  task: () => Promise<T>,
  opts: { attempts?: number; baseDelayMs?: number; onRetry?: (attempt: number) => void } = {},
): Promise<T> {
  const attempts = Math.max(1, opts.attempts ?? 3);
  const baseMs = opts.baseDelayMs ?? 600;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) break;
      opts.onRetry?.(attempt);
      await sleep(Math.round(baseMs * 2 ** attempt * (0.8 + Math.random() * 0.4)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
