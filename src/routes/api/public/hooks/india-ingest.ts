import { createFileRoute } from "@tanstack/react-router";

/**
 * India desk ingest hook.
 *
 * Reads the India publishers (national, Telangana, Andhra, immigration, NRI),
 * each inside its own try/catch, and logs one `ingest_runs` row per source.
 * Called by the scheduled job, by /admin/health's "Run now" and manually.
 * Body: { "source": "The Hindu" } limits the run to one publisher.
 */
export const Route = createFileRoute("/api/public/hooks/india-ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { hookAuthorized, unauthorized } = await import("@/lib/hook-auth.server");
        if (!(await hookAuthorized(request))) return unauthorized();

        const body = (await request.json().catch(() => ({}))) as {
          source?: string;
          trigger?: string;
          budgetMs?: number;
        };
        const { runIndiaIngest } = await import("@/lib/india-ingest.server");
        try {
          const summary = await runIndiaIngest({
            ...(body.source ? { source: body.source } : {}),
            trigger: body.trigger === "manual" ? "manual" : "cron",
            ...(body.budgetMs ? { budgetMs: body.budgetMs } : {}),
          });
          return Response.json({ ok: true, ...summary });
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : String(e) },
            { status: 500 },
          );
        }
      },
    },
  },
});
