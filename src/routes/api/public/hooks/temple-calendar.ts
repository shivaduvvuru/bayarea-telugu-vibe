import { createFileRoute } from "@tanstack/react-router";

/**
 * Temple Calendar collection hook.
 *
 * Reads publicly published programs from every active temple source (ICS/RSS
 * first, structured pages only as a fallback) and upserts them into the master
 * temple_events store. Meant for a once/twice-daily schedule; also powers the
 * admin "Refresh now" button. Auth is the shared ingest-hook token or an
 * unlocked editorial-desk session.
 */
export const Route = createFileRoute("/api/public/hooks/temple-calendar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { hookAuthorized, unauthorized } = await import("@/lib/hook-auth.server");
        if (!(await hookAuthorized(request))) return unauthorized();

        const body = (await request.json().catch(() => ({}))) as {
          slug?: string;
          budgetMs?: number;
        };
        const { runTempleCalendarIngest } = await import("@/lib/temple-calendar.server");
        try {
          const summary = await runTempleCalendarIngest({
            budgetMs: Math.min(Math.max(body.budgetMs ?? 70_000, 5_000), 90_000),
            ...(body.slug ? { slug: body.slug } : {}),
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
