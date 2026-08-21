import { createFileRoute } from "@tanstack/react-router";

/**
 * Times Bay Area source ingestion hook.
 *
 * Reads the due sources from the registry through their connector, writes new
 * items into raw_ingestion_items and records per-source health. Called by the
 * scheduled job and by the Command Center's "Collect now" button. Auth is the
 * shared ingest-hook token or an unlocked editorial desk session.
 */
export const Route = createFileRoute("/api/public/hooks/ingest-sources")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { hookAuthorized, unauthorized } = await import("@/lib/hook-auth.server");
        if (!(await hookAuthorized(request))) return unauthorized();

        const body = (await request.json().catch(() => ({}))) as {
          sourceId?: string;
          budgetMs?: number;
        };
        const { runIngestion } = await import("@/lib/ingest.server");
        try {
          const summary = await runIngestion({
            budgetMs: Math.min(Math.max(body.budgetMs ?? 60_000, 5_000), 90_000),
            ...(body.sourceId ? { sourceId: body.sourceId } : {}),
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
