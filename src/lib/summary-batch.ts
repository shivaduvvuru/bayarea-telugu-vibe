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
 *    malformed, missing, empty or unknown entry is reported and re-summarized
 *    one item at a time, so a bad batch degrades into extra calls rather than
 *    wrong or missing summaries.
 *
 * Deliberately free of network, Supabase and React imports so the ingest tests
 * can drive it with a fake model.
 */

import { mapWithLimit, newRetryStats, withRetry, type RetryStats } from "./retry";

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
export function dedupeEntries<G extends { key: string; desk: string }>(
  entries: readonly SummaryEntry<G>[],
  keysOf: (entry: SummaryEntry<G>) => readonly (string | null | undefined)[],
): { queue: SummaryEntry<G>[]; aliases: Map<string, string>; dropped: number } {
  const queue: SummaryEntry<G>[] = [];
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
 * Summarizes every entry, batching where possible and falling back to one call
 * per item for anything a batch failed to return validly.
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
  metrics.batches += chunks.length;

  const needsFallback: SummaryEntry<G>[] = [];

  await mapWithLimit(
    chunks,
    opts.concurrency ?? SUMMARY_CONCURRENCY,
    async (chunk, batchIndex) => {
      const ids = chunk.map((e) => e.id);
      const desks = [...new Set(chunk.map((e) => e.group.desk))].join(", ");
      try {
        const text = await withRetry(() => {
          metrics.calls += 1;
          metrics.itemsSummarized += chunk.length;
          return call(buildPrompt(chunk), "batch");
        }, {
          attempts: opts.attempts ?? 3,
          baseMs: opts.baseMs ?? 800,
          label: `gemini batch ${batchIndex + 1} (${chunk.length} items)`,
          stats: metrics.retry,
          log,
        });
        const result = validateBatchResponse(text, ids);
        for (const [id, summary] of result.summaries) summaries.set(id, summary);
        if (result.malformed) metrics.malformedBatches += 1;
        metrics.missingEntries += result.missing.length;
        metrics.unknownEntries += result.unknown.length;
        if (result.malformed || result.missing.length || result.unknown.length) {
          const note =
            `[summarize] batch ${batchIndex + 1} invalid (${desks}): ` +
            `${result.malformed ? "malformed JSON, " : ""}` +
            `${result.missing.length} missing, ${result.unknown.length} unknown id(s) — ` +
            `falling back to per-item summaries`;
          log(note);
          errors.push(note);
          for (const entry of chunk) if (result.missing.includes(entry.id)) needsFallback.push(entry);
        }
      } catch (error) {
        const note = `[summarize] batch ${batchIndex + 1} failed (${desks}): ${
          error instanceof Error ? error.message : String(error)
        }`;
        log(note);
        errors.push(note);
        needsFallback.push(...chunk);
      }
    },
    { label: "gemini summary batches", stats: metrics.retry, log },
  );

  if (needsFallback.length) {
    await mapWithLimit(
      needsFallback,
      opts.concurrency ?? SUMMARY_CONCURRENCY,
      async (entry) => {
        try {
          const text = await withRetry(() => {
            metrics.calls += 1;
            metrics.fallbackCalls += 1;
            return call(buildPrompt([entry]), "item");
          }, {
            attempts: opts.attempts ?? 2,
            baseMs: opts.baseMs ?? 800,
            label: `gemini per-item retry ${entry.id}`,
            stats: metrics.retry,
            log,
          });
          const single = validateBatchResponse(text, [entry.id]);
          const summary = single.summaries.get(entry.id);
          if (summary) summaries.set(entry.id, summary);
          else metrics.unresolved += 1;
        } catch (error) {
          metrics.unresolved += 1;
          log(
            `[summarize] per-item summary failed for ${entry.id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      },
      { label: "gemini per-item summaries", stats: metrics.retry, log },
    );
  }

  return { summaries, metrics, errors };
}

/** Average items per batched call — the headline number on the admin panel. */
export function averageBatchSize(m: BatchMetrics): number {
  if (!m.batches) return 0;
  return Math.round((m.itemsSummarized / m.batches) * 10) / 10;
}

/**
 * Share of sent headlines a batch failed to return validly — the truncation
 * rate. Rising values mean the batches are getting too big for the model.
 */
export function truncationRate(m: BatchMetrics): number {
  if (!m.itemsSummarized) return 0;
  return Math.min(1, Math.round((m.missingEntries / m.itemsSummarized) * 1000) / 1000);
}
