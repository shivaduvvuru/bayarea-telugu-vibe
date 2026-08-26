import { createFileRoute } from "@tanstack/react-router";

/**
 * Nightly Glamour pocket swap.
 *
 * The live Glamour folder holds one pocket (~50 pictures) and the rest of the
 * collection waits in the archive. `rotateGalleryFolder()` is a no-op while the
 * folder sits at capacity, so without this job archived pictures never come
 * forward. Runs at 07:50 UTC — ten minutes before the day-seed boundary — so
 * readers get the new pocket and the new ordering together at 1 AM Pacific.
 *
 *   POST /api/public/hooks/glamour-pocket
 *   Authorization: Bearer <public.hook_token('ingest')>
 *   { "trigger": "cron" }
 */
export const Route = createFileRoute("/api/public/hooks/glamour-pocket")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { hookAuthorized, unauthorized } = await import("@/lib/hook-auth.server");
        if (!(await hookAuthorized(request))) return unauthorized();

        let trigger = "cron";
        try {
          const body = (await request.json()) as { trigger?: string } | null;
          if (body?.trigger) trigger = String(body.trigger).slice(0, 40);
        } catch {
          /* body is optional */
        }

        const startedAt = Date.now();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        try {
          const { swapGalleryPocket } = await import("@/lib/gallery-archive.server");
          const result = await swapGalleryPocket(supabaseAdmin as never);
          const finishedAt = new Date().toISOString();
          try {
            await supabaseAdmin.from("collect_runs").insert({
              mode: "glamour-pocket",
              trigger,
              collected: result.restored,
              published: result.restored,
              held: result.archived,
              duplicates_hidden: 0,
              funnel: {
                archived: result.archived,
                restored: result.restored,
                live: result.live,
                elapsedMs: Date.now() - startedAt,
              },
              ok: true,
              finished_at: finishedAt,
            } as never);
          } catch {
            /* logging must never break the swap */
          }
          return Response.json({ ok: true, ...result, at: finishedAt });
        } catch (e) {
          const { errorMessage } = await import("@/lib/error-message");
          const message = errorMessage(e);
          console.error("glamour-pocket swap failed", message);
          try {
            await supabaseAdmin
              .from("collect_runs")
              .insert({ mode: "glamour-pocket", trigger, ok: false, error: message } as never);
          } catch {
            /* never mask the original failure */
          }
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
