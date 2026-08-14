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
