import { createFileRoute } from "@tanstack/react-router";

/** Daily New India Abroad headline metadata sync. */
export const Route = createFileRoute("/api/public/hooks/syndicate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { hookAuthorized, unauthorized } = await import("@/lib/hook-auth.server");
        if (!(await hookAuthorized(request))) return unauthorized();
        let trigger: "cron" | "manual" = "cron";
        try {
          const body = (await request.json()) as { trigger?: string };
          if (body?.trigger === "manual") trigger = "manual";
        } catch {
          /* Empty body is a valid cron request. */
        }
        try {
          const { syndicateNewIndiaAbroad } = await import("@/lib/syndicate-nia.server");
          const result = await syndicateNewIndiaAbroad(trigger);
          return Response.json(result, { status: result.ok ? 200 : 502 });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Syndication failed";
          console.error("New India Abroad hook failed", message);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
