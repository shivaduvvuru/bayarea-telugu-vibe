import { describe, expect, it } from "vitest";
import {
  buildPrompt,
  chunkEntries,
  callsPerHeadline,
  dedupeEntries,
  topSingleCallSources,
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
    const ids = [...prompt.matchAll(/\{"id": "([^"<]+)", "desk": "([^"]+)", "headline": "([^"]+)"/g)];
    // Dropping only happens on batched calls, so the per-item retry succeeds.
    const batched = ids.length > 1;
    const rows = ids
      .filter(([, id]) => !(batched && typeof id === "string" && opts.drop?.includes(id)))
      .map(([, id, desk, headline]) => ({ id, summary: `${desk}: ${headline}` }));
    if (opts.extra) rows.push({ id: "not-a-real-id", summary: "invented" });
    return JSON.stringify(rows);
  };
  return { call, prompts };
}

describe("chunkEntries", () => {
  it("caps items per call", () => {
    const many = Array.from({ length: 30 }, (_, i) => entry(`a#${i}`, "San Jose", `t${i}`));
    // SUMMARY_ITEM_CAP is 12 headlines per Gemini call.
    expect(chunkEntries(many).map((c) => c.length)).toEqual([12, 12, 6]);
  });


  it("never splits a call just because desks differ", () => {
    // The regression: one call per source group. Many desks now share one call.
    const desks = Array.from({ length: 12 }, (_, i) => entry(`d${i}#0`, `desk-${i}`, `t${i}`));
    expect(chunkEntries(desks)).toHaveLength(1);
  });
});

describe("dedupeEntries", () => {
  it("keeps one copy of a story that arrived from several feeds", () => {
    const rows = [
      { id: "a", url: "https://x.com/story", title: "Same Story" },
      { id: "b", url: "https://x.com/story?utm_source=rss", title: "Same story" },
      { id: "c", url: "https://y.com/other", title: "Other story" },
    ];
    const { queue, aliases, dropped } = dedupeEntries(rows, (r) => [r.url.split("?")[0], r.title.toLowerCase()]);
    expect(queue.map((r) => r.id)).toEqual(["a", "c"]);
    expect(aliases.get("b")).toBe("a");
    expect(dropped).toBe(1);
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
      const summary = summaries.get(e.id);
      expect(summary).toBeDefined();
      if (!summary) continue;
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
    expect(metrics.batches).toBe(1); // 3 desks, 4 headlines — one call
    expect(metrics.calls).toBe(1);

    const empty = newBatchMetrics();
    const idle = echoModel();
    await runSummaryBatches([], idle.call, { metrics: empty });
    expect(idle.prompts).toHaveLength(0);
    expect(empty.calls).toBe(0);
  });

  it("halves a partly failed batch instead of going straight to singles", async () => {
    const big = Array.from({ length: 8 }, (_, i) => entry(`x#${i}`, "San Jose", `headline ${i}`));
    const metrics = newBatchMetrics();
    let calls = 0;
    const sizes: number[] = [];
    await runSummaryBatches(
      big,
      async (prompt) => {
        const ids = [...prompt.matchAll(/\{"id": "([^"<]+)"/g)]
          .map((m) => m[1])
          .filter((id): id is string => typeof id === "string");
        sizes.push(ids.length);
        calls += 1;
        // The first call returns nothing usable; every later call is fine.
        if (calls === 1) return "not json";
        return JSON.stringify(ids.map((id) => ({ id, summary: `S ${id}` })));
      },
      { metrics, baseMs: 1, log: () => {} },
    );
    expect(sizes[0]).toBe(8);
    // Retried as one batch first, and never as eight single-item calls.
    expect(sizes[1]).toBe(8);
    expect(metrics.fallbackCalls).toBe(0);
    // Every headline counted once, no matter how many calls it took.
    expect(metrics.itemsSummarized).toBe(8);
    expect(callsPerHeadline(metrics)).toBeLessThan(0.35);
  });

  it("does not split a throttled batch into more calls", async () => {
    const big = Array.from({ length: 8 }, (_, i) => entry(`r#${i}`, "Cinema", `headline ${i}`));
    const metrics = newBatchMetrics();
    const sizes: number[] = [];
    const { summaries } = await runSummaryBatches(
      big,
      async (prompt) => {
        sizes.push([...prompt.matchAll(/\{"id": "([^"<]+)"/g)].length);
        throw new Error("429 rate limit");
      },
      { metrics, baseMs: 1, attempts: 3, log: () => {} },
    );

    expect(sizes).toEqual([8, 8, 8]);
    expect(metrics.calls).toBe(3);
    expect(metrics.retry.retries).toBe(2);
    expect(metrics.fallbackCalls).toBe(0);
    expect(metrics.unresolved).toBe(8);
    expect(summaries.size).toBe(0);
  });

  it("halves token-limit failures because smaller batches can fit", async () => {
    const big = Array.from({ length: 8 }, (_, i) => entry(`t#${i}`, "Cinema", `headline ${i}`));
    const metrics = newBatchMetrics();
    const sizes: number[] = [];
    const { summaries } = await runSummaryBatches(
      big,
      async (prompt) => {
        const ids = [...prompt.matchAll(/\{"id": "([^"<]+)"/g)]
          .map((m) => m[1])
          .filter((id): id is string => typeof id === "string");
        sizes.push(ids.length);
        if (ids.length > 4) throw new Error("400 token limit exceeded");
        return JSON.stringify(ids.map((id) => ({ id, summary: `S ${id}` })));
      },
      { metrics, baseMs: 1, attempts: 2, log: () => {} },
    );

    expect(sizes).toEqual([8, 4, 4]);
    expect(metrics.fallbackCalls).toBe(0);
    expect(summaries.size).toBe(8);
  });

  it("attributes single-item calls to their publisher", async () => {
    const metrics = newBatchMetrics();
    await runSummaryBatches(
      [
        { ...entry("p#0", "San Jose", "one (Variety)"), source: "Variety" },
        { ...entry("p#1", "San Jose", "two (Deadline)"), source: "Deadline" },
      ],
      async (prompt) => {
        const ids = [...prompt.matchAll(/\{"id": "([^"<]+)"/g)]
          .map((m) => m[1])
          .filter((id): id is string => typeof id === "string");
        if (ids.length > 1) return "not json";
        return JSON.stringify(ids.map((id) => ({ id, summary: `S ${id}` })));
      },
      { metrics, baseMs: 1, log: () => {} },
    );
    expect(metrics.fallbackCalls).toBe(2);
    expect(topSingleCallSources(metrics).map((s) => s.source).sort()).toEqual(["Deadline", "Variety"]);
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
      FIXTURE.slice(0, 1),
      async (prompt) => {
        attempts++;
        if (attempts === 1) throw new Error("429 rate limit");
        return echoModel().call(prompt);
      },
      { metrics, baseMs: 1, log: () => {} },
    );
    expect(attempts).toBe(2);
    expect(metrics.calls).toBe(2);
    expect(metrics.retry.retries).toBe(1);
    expect(summaries.size).toBe(1);
  });

  it("keeps the placeholder when every call fails, and says so", async () => {
    const metrics = newBatchMetrics();
    const { summaries } = await runSummaryBatches(
      FIXTURE.slice(0, 1),
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
