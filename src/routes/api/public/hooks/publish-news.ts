import { createFileRoute } from "@tanstack/react-router";

/**
 * Automatic publishing hook.
 *
 * Collection is slow; publishing is not. This endpoint only moves already
 * collected, duplicate-checked items onto the site — the digest-queue backlog
 * (Bay Area news, India, Cinema/OTT, Micro-Drama, events, temple notices) plus
 * the source-registry queue. Runs on a short schedule so the sections never go
 * stale even when a long collection pass is cut short.
 */
export const Route = createFileRoute("/api/public/hooks/publish-news")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { hookAuthorized, unauthorized } = await import("@/lib/hook-auth.server");
        if (!(await hookAuthorized(request))) return unauthorized();

        try {
          const { publishNewsBacklog } = await import("@/lib/publish-backlog.server");
          const queue = await publishNewsBacklog();
          const { autoApproveNewsQueue } = await import("@/lib/auto-approve.server");
          const registry = await autoApproveNewsQueue().catch(() => ({
            duplicates: 0,
            approved: 0,
            published: 0,
          }));
          return Response.json({ ok: true, queue, registry });
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
