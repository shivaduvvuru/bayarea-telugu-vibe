import { describe, expect, it } from "vitest";
import {
  buildPrompt,
  chunkEntries,
  newBatchMetrics,
  runSummaryBatches,
  validateBatchResponse,
  type SummaryEntry,
} from "./summary-batch";
import { baselineOf, metricsRow, regressionWarnings } from "./summary-metrics.server";

type G = { key: string; desk: string };

const entry = (id: string, desk: string, text: string): SummaryEntry<G> => ({
  id,
  group: { key: desk, desk },
  text,
});

/** Three desks with unmistakably different facts, so any bleed is visible. */
const FIXTURE: SummaryEntry<G>[] = [
  entry("sj#0", "San Jose", "San Jose council approves 400 new homes near Berryessa (Mercury News)"),
  entry("sj#1", "San Jose", "Telugu association opens free tutoring centre in San Jose (India Currents)"),
  entry("fr#0", "Fremont", "Fremont library extends weekend hours through December (Fremont Bulletin)"),
  entry("hy#0", "Hyderabad", "Hyderabad metro phase two clears state cabinet (Deccan Chronicle)"),
];

/** A model that echoes each headline back, keyed by the id it was given. */
function echoModel(opts: { drop?: string[]; extra?: boolean; garbage?: boolean } = {}) {
  const prompts: string[] = [];
  const call = async (prompt: string) => {
    prompts.push(prompt);
    if (opts.garbage && prompts.length === 1) return "Sure! Here are your summaries:";
    const ids = [...prompt.matchAll(/\{"id": "([^"]+)", "desk": "([^"]+)", "headline": "([^"]+)"/g)];
    const rows = ids
      .filter(([, id]) => !opts.drop?.includes(id!))
      .map(([, id, desk, headline]) => ({ id, summary: `${desk}: ${headline}` }));
    if (opts.extra) rows.push({ id: "not-a-real-id", summary: "invented" });
    return JSON.stringify(rows);
  };
  return { call, prompts };
}

describe("chunkEntries", () => {
  it("caps items and desks per call", () => {
    const many = Array.from({ length: 30 }, (_, i) => entry(`a#${i}`, "San Jose", `t${i}`));
    expect(chunkEntries(many).map((c) => c.length)).toEqual([25, 5]);

    const desks = ["a", "b", "c", "d"].map((d) => entry(`${d}#0`, d, d));
    const chunks = chunkEntries(desks);
    expect(chunks).toHaveLength(2);
    expect(new Set(chunks[0]!.map((e) => e.group.desk)).size).toBe(3);
  });
});

describe("buildPrompt", () => {
  it("carries each id with its own headline and forbids mixing", () => {
    const prompt = buildPrompt(FIXTURE);
    for (const e of FIXTURE) {
      expect(prompt).toContain(`"id": "${e.id}"`);
      expect(prompt).toContain(e.text);
    }
    expect(prompt).toMatch(/never mix facts/i);
  });
});

describe("validateBatchResponse", () => {
  const ids = ["a", "b"];

  it("accepts a clean id-keyed array", () => {
    const r = validateBatchResponse('[{"id":"a","summary":"A."},{"id":"b","summary":"B."}]', ids);
    expect(r.malformed).toBe(false);
    expect(r.missing).toEqual([]);
    expect(r.summaries.get("a")).toBe("A.");
  });

  it("tolerates prose around the JSON but reports non-JSON as malformed", () => {
    expect(validateBatchResponse('here you go: [{"id":"a","summary":"A."}] done', ["a"]).summaries.get("a")).toBe("A.");
    const bad = validateBatchResponse("no json at all", ids);
    expect(bad.malformed).toBe(true);
    expect(bad.missing).toEqual(ids);
  });

  it("reports missing, empty and unknown entries instead of guessing", () => {
    const r = validateBatchResponse(
      '[{"id":"a","summary":""},{"id":"zzz","summary":"other story"}]',
      ids,
    );
    expect(r.missing).toEqual(["a", "b"]);
    expect(r.unknown).toEqual(["zzz"]);
    expect(r.summaries.size).toBe(0);
  });

  it("never lets position or a duplicated id decide the mapping", () => {
    const r = validateBatchResponse(
      '[{"id":"b","summary":"B."},{"id":"a","summary":"A."},{"id":"a","summary":"HIJACK"}]',
      ids,
    );
    expect(r.summaries.get("a")).toBe("A.");
    expect(r.summaries.get("b")).toBe("B.");
  });
});

describe("runSummaryBatches", () => {
  it("maps every summary to the id and desk it was sent with", async () => {
    const model = echoModel();
    const metrics = newBatchMetrics();
    const { summaries } = await runSummaryBatches(FIXTURE, model.call, { metrics, log: () => {} });

    expect(summaries.size).toBe(4);
    // Each summary must repeat its own desk and its own headline, and must not
    // contain any other item's headline.
    for (const e of FIXTURE) {
      const summary = summaries.get(e.id)!;
      expect(summary).toContain(e.group.desk);
      expect(summary).toContain(e.text);
      for (const other of FIXTURE) {
        if (other.id !== e.id) expect(summary).not.toContain(other.text);
      }
    }
    expect(metrics.malformedBatches).toBe(0);
    expect(metrics.missingEntries).toBe(0);
    expect(metrics.fallbackCalls).toBe(0);
  });

  it("batches desks together and makes no call when there is nothing to do", async () => {
    const model = echoModel();
    const metrics = newBatchMetrics();
    await runSummaryBatches(FIXTURE, model.call, { metrics, log: () => {} });
    expect(metrics.batches).toBe(2); // 3 desks + 1
    expect(metrics.calls).toBe(2);

    const empty = newBatchMetrics();
    const idle = echoModel();
    await runSummaryBatches([], idle.call, { metrics: empty });
    expect(idle.prompts).toHaveLength(0);
    expect(empty.calls).toBe(0);
  });

  it("fails over to per-item calls for dropped entries", async () => {
    const model = echoModel({ drop: ["sj#1"] });
    const metrics = newBatchMetrics();
    const { summaries } = await runSummaryBatches(FIXTURE, model.call, { metrics, log: () => {} });

    expect(metrics.missingEntries).toBe(1);
    expect(metrics.fallbackCalls).toBe(1);
    expect(metrics.unresolved).toBe(0);
    // The recovered item still gets its own headline, not its neighbour's.
    expect(summaries.get("sj#1")).toContain("free tutoring centre");
    expect(summaries.get("sj#0")).not.toContain("free tutoring centre");
  });

  it("re-summarizes a malformed batch one item at a time and drops invented ids", async () => {
    const model = echoModel({ garbage: true, extra: true });
    const metrics = newBatchMetrics();
    const { summaries, errors } = await runSummaryBatches(FIXTURE, model.call, {
      metrics,
      log: () => {},
    });

    expect(metrics.malformedBatches).toBeGreaterThan(0);
    expect(errors.join(" ")).toMatch(/malformed JSON/);
    expect(summaries.has("not-a-real-id")).toBe(false);
    expect(summaries.size).toBe(4);
  });

  it("retries a transient failure before giving up", async () => {
    let attempts = 0;
    const metrics = newBatchMetrics();
    const { summaries } = await runSummaryBatches(
      [FIXTURE[0]!],
      async (prompt) => {
        attempts++;
        if (attempts === 1) throw new Error("429 rate limit");
        return echoModel().call(prompt);
      },
      { metrics, baseMs: 1, log: () => {} },
    );
    expect(attempts).toBe(2);
    expect(metrics.retry.retries).toBe(1);
    expect(summaries.size).toBe(1);
  });

  it("keeps the placeholder when every call fails, and says so", async () => {
    const metrics = newBatchMetrics();
    const { summaries } = await runSummaryBatches(
      [FIXTURE[0]!],
      async () => {
        throw new Error("503 upstream down");
      },
      { metrics, baseMs: 1, attempts: 2, log: () => {} },
    );
    expect(summaries.size).toBe(0);
    expect(metrics.unresolved).toBe(1);
  });
});

describe("regression warnings", () => {
  const run = (over: Partial<ReturnType<typeof metricsRow>>) => ({
    ...metricsRow(newBatchMetrics(), 0, "test"),
    ...over,
  });

  it("stays quiet on a healthy run", () => {
    const good = run({ calls: 2, batches: 2, items_summarized: 40, truncation_rate: 0 });
    const baseline = baselineOf([good, good, good]);
    expect(regressionWarnings(good, baseline)).toEqual([]);
  });

  it("flags a call-count regression and rising truncation", () => {
    const good = run({ calls: 2, batches: 2, items_summarized: 40 });
    const baseline = baselineOf([good, good, good]);
    const bad = run({ calls: 40, batches: 40, items_summarized: 40, truncation_rate: 0.2, missing_entries: 8 });
    const warnings = regressionWarnings(bad, baseline);
    expect(warnings.join(" ")).toMatch(/Truncation rate/);
    expect(warnings.join(" ")).toMatch(/calls per headline/);
  });

  it("flags malformed batches and unresolved items", () => {
    const warnings = regressionWarnings(
      run({ calls: 4, batches: 2, items_summarized: 20, malformed_batches: 1, unresolved: 2 }),
      baselineOf([]),
    );
    expect(warnings.join(" ")).toMatch(/not valid id-keyed JSON/);
    expect(warnings.join(" ")).toMatch(/placeholder summary/);
  });
});
