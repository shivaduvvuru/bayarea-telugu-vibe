/**
 * Batched Gemini summarization: packing, prompt building, response validation
 * and per-item failover.
 *
 * The model is asked for several desks' headlines in one call, which is where
 * the credit saving comes from — and also where the two risks live: facts can
 * bleed between items, and a malformed reply can silently drop entries. This
 * module owns both defences:
 *
 *  - every headline travels with its own opaque id and desk label, and the
 *    returned summary is matched back by that id only (never by position), so a
 *    reordered or partial reply can never attach one item's text to another;
 *  - the reply is validated against the exact set of ids that was sent. Any
 *    malformed, missing, empty or unknown entry is reported and retried safely,
 *    so a bad batch degrades into controlled retries rather than wrong or
 *    missing summaries.
 *
 * Deliberately free of network, Supabase and React imports so the ingest tests
 * can drive it with a fake model.
 */

import { isTokenLimit, mapWithLimit, newRetryStats, withRetry, type RetryStats } from "./retry";

/** One headline queued for summarization. */
export interface SummaryEntry<G extends { key: string; desk: string }> {
  id: string;
  group: G;
  /** Text handed to the model — headline plus publisher. */
  text: string;
  /** Publisher name, used only to attribute single-item calls in the guard log. */
  source?: string;
}

export interface BatchMetrics {
  /** Model calls made, batched and per-item failovers together. */
  calls: number;
  /** Batched (multi-item) calls. */
  batches: number;
  /** Per-item failover calls caused by an invalid batch reply. */
  fallbackCalls: number;
  itemsSummarized: number;
  /** Batches whose reply was not usable id-keyed JSON at all. */
  malformedBatches: number;
  /** Entries a batch failed to return (or returned empty). */
  missingEntries: number;
  /** Entries the model returned under an id that was never sent. */
  unknownEntries: number;
  /** Entries left on the fallback sentence because every call failed. */
  unresolved: number;
  /** Items sent inside multi-item calls — the divisor for average batch size. */
  batchedItems: number;
  /** Publishers that caused single-item calls, for the calls-per-headline guard. */
  singleItemSources: Record<string, number>;
  retry: RetryStats;
}

export function newBatchMetrics(): BatchMetrics {
  return {
    calls: 0,
    batches: 0,
    fallbackCalls: 0,
    itemsSummarized: 0,
    malformedBatches: 0,
    missingEntries: 0,
    unknownEntries: 0,
    unresolved: 0,
    batchedItems: 0,
    singleItemSources: {},
    retry: newRetryStats(),
  };
}

/** Headlines per batched call. Kept well under the point where quality drops. */
export const SUMMARY_ITEM_CAP = 25;
/**
 * Desks combined into one call. Unlimited by design: capping desks per call was
 * the batching regression — every extra source added its own small remainder
 * call, pushing calls-per-headline up. Item bodies are truncated instead, so a
 * mixed-desk batch still fits the token budget.
 */
export const SUMMARY_GROUP_CAP = Number.POSITIVE_INFINITY;
/** Batched calls allowed in flight at once — the gateway budget is shared. */
export const SUMMARY_CONCURRENCY = 2;
/** Per-headline characters sent to the model, so long-body sources never split a batch. */
export const SUMMARY_TEXT_CAP = 800;

/** Packs entries into calls of at most SUMMARY_ITEM_CAP items / groupCap desks. */
export function chunkEntries<G extends { key: string; desk: string }>(
  entries: readonly SummaryEntry<G>[],
  itemCap = SUMMARY_ITEM_CAP,
  groupCap = SUMMARY_GROUP_CAP,
): SummaryEntry<G>[][] {
  const chunks: SummaryEntry<G>[][] = [];
  let current: SummaryEntry<G>[] = [];
  let groups = new Set<string>();
  for (const entry of entries) {
    const full =
      current.length >= itemCap ||
      (!groups.has(entry.group.key) && groups.size >= groupCap);
    if (full && current.length) {
      chunks.push(current);
      current = [];
      groups = new Set();
    }
    current.push(entry);
    groups.add(entry.group.key);
  }
  if (current.length) chunks.push(current);
  return chunks;
}

/** Drops entries whose canonical link or normalized title was already queued. */
export function dedupeEntries<E extends { id: string }>(
  entries: readonly E[],
  keysOf: (entry: E) => readonly (string | null | undefined)[],
): { queue: E[]; aliases: Map<string, string>; dropped: number } {
  const queue: E[] = [];
  const seen = new Map<string, string>();
  const aliases = new Map<string, string>();
  for (const entry of entries) {
    const keys = keysOf(entry).filter((k): k is string => !!k);
    const hit = keys.map((k) => seen.get(k)).find((id) => !!id);
    if (hit) {
      aliases.set(entry.id, hit);
      continue;
    }
    queue.push(entry);
    for (const key of keys) if (!seen.has(key)) seen.set(key, entry.id);
  }
  return { queue, aliases, dropped: entries.length - queue.length };
}


/** The prompt for one call. Each item is a self-contained JSON line with its id. */
export function buildPrompt<G extends { key: string; desk: string }>(
  entries: readonly SummaryEntry<G>[],
): string {
  const desks = [...new Set(entries.map((e) => e.group.desk))];
  return (
    `You write short neutral notes for a Telugu-American community news desk.\n` +
    `Each item below belongs to one of these desks: ${desks.join(", ")}. Treat every item on its own — never mix facts between items or desks.\n` +
    `For each item write ONE neutral sentence (max 28 words) summarizing that headline only. Do not invent facts beyond that item's headline, do not borrow details from another item, and do not add a local or Bay Area angle unless the headline itself has one.\n` +
    `Reply with JSON only: an array of {"id": "<the item id>", "summary": "<sentence>"} with exactly ${entries.length} entries, one per item id given below. No prose, no code fence.\n\n` +
    entries
      .map((e) => {
        // Long-body publishers are truncated so a token budget never forces the
        // batch to split into single-item calls.
        const text = e.text.length > SUMMARY_TEXT_CAP ? `${e.text.slice(0, SUMMARY_TEXT_CAP)}…` : e.text;
        return `{"id": ${JSON.stringify(e.id)}, "desk": ${JSON.stringify(e.group.desk)}, "headline": ${JSON.stringify(text)}}`;
      })
      .join("\n")
  );
}

export type ValidationResult = {
  /** Summaries accepted, keyed by the id that was sent. */
  summaries: Map<string, string>;
  /** Ids that were sent but came back missing, empty or wrongly typed. */
  missing: string[];
  /** Ids the model invented. Always discarded — they cannot be matched safely. */
  unknown: string[];
  /** True when the reply was not a JSON array of id/summary objects at all. */
  malformed: boolean;
};

/**
 * Validates one reply against the ids that were sent. Matching is by id only;
 * anything else is reported for per-item failover.
 */
export function validateBatchResponse(
  text: string,
  expectedIds: readonly string[],
): ValidationResult {
  const expected = new Set(expectedIds);
  const summaries = new Map<string, string>();
  const unknown: string[] = [];
  let malformed = false;

  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  let parsed: unknown = null;
  if (start >= 0 && end > start) {
    try {
      parsed = JSON.parse(text.slice(start, end + 1));
    } catch {
      parsed = null;
    }
  }

  if (!Array.isArray(parsed)) {
    malformed = true;
  } else {
    for (const row of parsed) {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        malformed = true;
        continue;
      }
      const { id, summary } = row as { id?: unknown; summary?: unknown };
      if (typeof id !== "string" || !id.trim() || typeof summary !== "string") {
        malformed = true;
        continue;
      }
      const clean = summary.trim();
      if (!clean) continue;
      if (!expected.has(id)) {
        unknown.push(id);
        continue;
      }
      // First value wins: a duplicated id is never allowed to overwrite.
      if (!summaries.has(id)) summaries.set(id, clean);
    }
  }

  const missing = expectedIds.filter((id) => !summaries.has(id));
  return { summaries, missing, unknown, malformed };
}

export type ModelCall = (prompt: string, kind: "batch" | "item") => Promise<string>;

export interface RunOptions {
  metrics?: BatchMetrics;
  concurrency?: number;
  itemCap?: number;
  groupCap?: number;
  log?: (line: string) => void;
  /** Retry attempts per model call. */
  attempts?: number;
  baseMs?: number;
}

/**
 * Summarizes every entry, batching where possible.
 *
 * A batch that fails from throttling is retried at the same size with backoff;
 * splitting would multiply calls into the same rate limit. Only token-limit or
 * malformed/missing JSON responses are halved, and single-item calls only happen
 * when the reduced batch is already one item.
 */
export async function runSummaryBatches<G extends { key: string; desk: string }>(
  entries: readonly SummaryEntry<G>[],
  call: ModelCall,
  opts: RunOptions = {},
): Promise<{ summaries: Map<string, string>; metrics: BatchMetrics; errors: string[] }> {
  const metrics = opts.metrics ?? newBatchMetrics();
  const log = opts.log ?? ((line: string) => console.log(line));
  const summaries = new Map<string, string>();
  const errors: string[] = [];
  if (!entries.length) return { summaries, metrics, errors };

  const chunks = chunkEntries(entries, opts.itemCap ?? SUMMARY_ITEM_CAP, opts.groupCap ?? SUMMARY_GROUP_CAP);

  // Counted once per distinct headline, never again on a retry or a split, so
  // calls-per-headline stays comparable across runs.
  metrics.itemsSummarized += entries.length;

  const attempts = opts.attempts ?? 3;
  const baseMs = opts.baseMs ?? 800;

  /** Runs one call for `chunk`; halves on failure instead of going per item. */
  const summarizeChunk = async (
    chunk: SummaryEntry<G>[],
    label: string,
    retriedWhole = false,
  ): Promise<void> => {
    const single = chunk.length === 1;
    const ids = chunk.map((e) => e.id);
    const desks = [...new Set(chunk.map((e) => e.group.desk))].join(", ");

    metrics.calls += 1;
    if (single) {
      metrics.fallbackCalls += 1;
      const source = chunk[0]!.source ?? chunk[0]!.group.desk;
      metrics.singleItemSources[source] = (metrics.singleItemSources[source] ?? 0) + 1;
    } else {
      metrics.batches += 1;
      metrics.batchedItems += chunk.length;
    }

    const halve = async (list: SummaryEntry<G>[]) => {
      if (list.length === 1) {
        await summarizeChunk(list, `${label}.single`);
        return;
      }
      const mid = Math.ceil(list.length / 2);
      await summarizeChunk(list.slice(0, mid), `${label}.a`);
      await summarizeChunk(list.slice(mid), `${label}.b`);
    };

    let text: string;
    try {
      text = await withRetry(() => call(buildPrompt(chunk), single ? "item" : "batch"), {
        attempts: single ? Math.min(2, attempts) : attempts,
        baseMs,
        label: `gemini ${label} (${chunk.length} items)`,
        stats: metrics.retry,
        log,
      });
    } catch (error) {
      const note = `[summarize] ${label} failed (${desks}): ${
        error instanceof Error ? error.message : String(error)
      }`;
      log(note);
      errors.push(note);
      if (single) metrics.unresolved += 1;
      else if (isTokenLimit(error)) await halve(chunk);
      else metrics.unresolved += chunk.length;
      return;
    }

    const result = validateBatchResponse(text, ids);
    for (const [id, summary] of result.summaries) summaries.set(id, summary);
    if (result.malformed) metrics.malformedBatches += 1;
    metrics.missingEntries += result.missing.length;
    metrics.unknownEntries += result.unknown.length;
    if (!result.missing.length) return;

    if (single) {
      metrics.unresolved += 1;
      return;
    }

    const pending = chunk.filter((e) => result.missing.includes(e.id));
    const wholeBatchMissing = pending.length === chunk.length;
    const note =
      `[summarize] ${label} invalid (${desks}): ` +
      `${result.malformed ? "malformed JSON, " : ""}` +
      `${result.missing.length} missing, ${result.unknown.length} unknown id(s) — ` +
      `${wholeBatchMissing && !retriedWhole ? "retrying as one batch" : "splitting the batch"}`;
    log(note);
    errors.push(note);

    if (wholeBatchMissing && !retriedWhole) {
      await summarizeChunk(chunk, `${label}.retry`, true);
      return;
    }
    await halve(pending);
  };

  await mapWithLimit(
    chunks,
    opts.concurrency ?? SUMMARY_CONCURRENCY,
    async (chunk, batchIndex) => summarizeChunk(chunk, `batch ${batchIndex + 1}`),
    { label: "gemini summary batches", stats: metrics.retry, log },
  );

  return { summaries, metrics, errors };
}

/** Calls made per headline sent — the guard number. Lower is better. */
export function callsPerHeadline(m: BatchMetrics): number {
  if (!m.itemsSummarized) return 0;
  return Math.round((m.calls / m.itemsSummarized) * 100) / 100;
}

/** Publishers responsible for the most single-item calls, worst first. */
export function topSingleCallSources(m: BatchMetrics, limit = 5): { source: string; calls: number }[] {
  return Object.entries(m.singleItemSources)
    .map(([source, calls]) => ({ source, calls }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, limit);
}


/** Average items per batched call — the headline number on the admin panel. */
export function averageBatchSize(m: BatchMetrics): number {
  if (!m.batches) return 0;
  return Math.round((m.batchedItems / m.batches) * 10) / 10;
}

/**
 * Share of sent headlines a batch failed to return validly — the truncation
 * rate. Rising values mean the batches are getting too big for the model.
 */
export function truncationRate(m: BatchMetrics): number {
  if (!m.itemsSummarized) return 0;
  return Math.min(1, Math.round((m.missingEntries / m.itemsSummarized) * 1000) / 1000);
}
