import { createFileRoute } from "@tanstack/react-router";

/**
 * Daily automated duplicate clean-up.
 *
 * Scans published stories for repeats that slipped past the write-time guard
 * (same normalised headline, same article URL, same lead image), keeps the
 * OLDEST copy and unpublishes the newer ones. Everything hidden is written to
 * `rejected_duplicates` for logging only — there is no review step.
 *
 * Schedule (already installed as the pg_cron job `daily-dedupe-sweep`, 02:20
 * daily), same shape as the news collection hooks:
 *
 *   POST https://project--21d2eeed-01e3-4e0e-a028-88e01859acea.lovable.app/api/public/hooks/dedupe-sweep
 *   Authorization: Bearer <public.hook_token('ingest')>
 *   { "trigger": "cron" }
 */
export const Route = createFileRoute("/api/public/hooks/dedupe-sweep")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { hookAuthorized, unauthorized } = await import("@/lib/hook-auth.server");
        if (!(await hookAuthorized(request))) return unauthorized();

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { sweepDuplicates } = await import("@/lib/dedupe-sweep.server");
          const hidden = await sweepDuplicates(supabaseAdmin as never);
          return Response.json({ ok: true, hidden });
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
