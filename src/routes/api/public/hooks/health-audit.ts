import { createFileRoute } from "@tanstack/react-router";

/**
 * Ingest self-audit hook.
 *
 * { } or { "mode": "daily" } — audit sections, sources and schedules, retry
 *   anything that missed its run, and Pushover only when something is flagged.
 * { "mode": "weekly" } — Monday digest of items per source over 7 days.
 * { "mode": "test" } — delivery test from /admin/health.
 */
export const Route = createFileRoute("/api/public/hooks/health-audit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { hookAuthorized, unauthorized } = await import("@/lib/hook-auth.server");
        if (!(await hookAuthorized(request))) return unauthorized();

        const body = (await request.json().catch(() => ({}))) as { mode?: string };
        try {
          if (body.mode === "weekly") {
            const { runWeeklyDigest } = await import("@/lib/health-audit.server");
            return Response.json({ ok: true, ...(await runWeeklyDigest()) });
          }
          if (body.mode === "test") {
            const { sendPushover } = await import("@/lib/pushover.server");
            const push = await sendPushover({
              title: "TBA ingest alert",
              message: "Test alert from Times Bay Area — alerting is working.",
              priority: 0,
            });
            return Response.json({ ok: push.ok, status: push.status, body: push.body });
          }
          const { runDailyAudit } = await import("@/lib/health-audit.server");
          const result = await runDailyAudit();
          return Response.json({
            ok: true,
            notified: result.notified,
            retried: result.retried,
            issues: result.report.issues,
          });
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
