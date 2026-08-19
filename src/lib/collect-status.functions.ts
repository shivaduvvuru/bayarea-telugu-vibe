import { createServerFn } from "@tanstack/react-start";

export type CollectRun = {
  mode: string;
  trigger: string;
  collected: number;
  published: number;
  held: number;
  duplicates_hidden: number;
  ok: boolean;
  finished_at: string;
};

/**
 * Latest collection-run summary for the "last pull" chip. Runs server-side so
 * the operational table stays staff-only, and internal error text is never
 * returned to the browser.
 */
export const latestCollectRun = createServerFn({ method: "POST" })
  .inputValidator((data: { mode?: string }) => ({
    mode: data?.mode === "gallery" ? "gallery" : "all",
  }))
  .handler(async ({ data }): Promise<CollectRun | null> => {
    const { admin } = await import("@/lib/cms.server");
    const db = await admin();
    const { data: rows } = await db
      .from("collect_runs")
      .select("mode, trigger, collected, published, held, duplicates_hidden, ok, finished_at")
      .eq("mode", data.mode)
      .order("finished_at", { ascending: false })
      .limit(1);
    return ((rows ?? [])[0] as CollectRun | undefined) ?? null;
  });

export type IntakeFunnel = {
  finishedAt: string;
  ok: boolean;
  error: string | null;
  discovered: number;
  candidates: number;
  safetyBlocked: number;
  duplicatesRemoved: number;
  toDesk: number;
  reasons: Record<string, number>;
  topSources: { name: string; discovered: number; candidates: number }[];
};

/**
 * Ingestion diagnostics for the desk banner: how many photos the last picture
 * pull discovered and where they were lost (image unusable, safety screen,
 * duplicate memory). Staff-only table, so it is read server-side.
 */
export const latestIntakeFunnel = createServerFn({ method: "POST" }).handler(
  async (): Promise<IntakeFunnel | null> => {
    const { admin } = await import("@/lib/cms.server");
    const db = await admin();
    const { data: rows } = await db
      .from("collect_runs")
      .select("ok, error, finished_at, funnel, duplicates_hidden")
      .eq("mode", "gallery")
      .order("finished_at", { ascending: false })
      .limit(1);
    const row = (rows ?? [])[0] as
      | {
          ok: boolean;
          error: string | null;
          finished_at: string;
          duplicates_hidden: number;
          funnel: Record<string, unknown> | null;
        }
      | undefined;
    if (!row) return null;
    const funnel = (row.funnel ?? {}) as Record<string, unknown>;
    const num = (key: string) => Number(funnel[key] ?? 0) || 0;
    const bySource = (funnel["bySource"] ?? {}) as Record<
      string,
      { discovered?: number; candidates?: number }
    >;
    return {
      finishedAt: row.finished_at,
      ok: row.ok,
      error: row.error ?? null,
      discovered: num("discovered"),
      candidates: num("candidates"),
      safetyBlocked: num("safetyBlocked"),
      duplicatesRemoved: num("duplicatesRemoved") || Number(row.duplicates_hidden ?? 0) || 0,
      toDesk: num("toDesk"),
      reasons: (funnel["reasons"] ?? {}) as Record<string, number>,
      topSources: Object.entries(bySource)
        .map(([name, v]) => ({
          name,
          discovered: Number(v?.discovered ?? 0) || 0,
          candidates: Number(v?.candidates ?? 0) || 0,
        }))
        .sort((a, b) => b.candidates - a.candidates || b.discovered - a.discovered)
        .slice(0, 6),
    };
  },
);
