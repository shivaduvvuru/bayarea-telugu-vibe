import { createFileRoute } from "@tanstack/react-router";

/**
 * Automatic directory fill from OpenStreetMap (zero cost, ODbL attribution).
 *
 * Authorization matches the news collection hooks: an `Authorization: Bearer
 * <hook_token('ingest')>` header, or an unlocked editorial-desk session.
 *
 * Scheduling (same pg_cron + net.http_post pattern as collect-news), hourly:
 *
 *   SELECT cron.schedule(
 *     'directory-ingest-hourly',
 *     '35 * * * *',
 *     $$
 *     SELECT net.http_post(
 *       url:='https://project--21d2eeed-01e3-4e0e-a028-88e01859acea.lovable.app/api/public/hooks/directory-ingest',
 *       headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||public.hook_token('ingest')),
 *       body:='{"trigger":"cron"}'::jsonb
 *     ) AS request_id;
 *     $$
 *   );
 *
 * Body (all optional):
 *   { "counties": ["alameda"], "categories": ["worship"], "maxQueries": 10, "preview": false }
 * With no counties/categories the run takes the next (county, category) slice
 * from a persisted cursor, so successive calls cover all nine counties and
 * every OSM-backed category before wrapping around to refresh stale rows.
 */
export const Route = createFileRoute("/api/public/hooks/directory-ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { hookAuthorized, unauthorized } = await import("@/lib/hook-auth.server");
        if (!(await hookAuthorized(request))) return unauthorized();

        const body = (await request.json().catch(() => ({}))) as {
          counties?: unknown;
          categories?: unknown;
          maxQueries?: unknown;
          preview?: unknown;
        };
        const asList = (value: unknown) =>
          Array.isArray(value) ? value.slice(0, 12).map(String) : [];
        const counties = asList(body.counties);
        const categories = asList(body.categories);
        const maxQueries = Math.min(Math.max(Number(body.maxQueries ?? 10) || 10, 1), 10);
        const preview = body.preview === true;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { ingestDirectoryFromOsm } = await import("@/lib/directory-osm.server");
        const { directorySlices, readSliceCursor, writeSliceCursor } = await import(
          "@/lib/directory-slices.server"
        );

        const slices = directorySlices();
        const explicit = counties.length > 0 || categories.length > 0;
        let cursor = 0;
        let slice = explicit ? null : slices[0]!;
        if (!explicit) {
          cursor = (await readSliceCursor(supabaseAdmin as never)) % slices.length;
          slice = slices[cursor]!;
        }

        const startedAt = Date.now();
        let report;
        try {
          report = await ingestDirectoryFromOsm(supabaseAdmin as never, {
            counties: explicit ? (counties.length ? counties : undefined) : [slice!.county],
            categories: explicit
              ? categories.length
                ? categories
                : undefined
              : [slice!.category],
            maxQueries,
            preview,
          });
        } catch (error) {
          return Response.json(
            { ok: false, error: error instanceof Error ? error.message : "Ingest failed" },
            { status: 500 },
          );
        }

        // 60-second budget: the Overpass loop already caps itself at maxQueries,
        // so we only record how much of the window the run consumed.
        const elapsedMs = Date.now() - startedAt;

        if (!explicit && !preview) {
          await writeSliceCursor(
            supabaseAdmin as never,
            cursor + 1,
            slices.length,
            `${slice!.county}:${slice!.category}`,
          );
        }

        return Response.json({
          ok: report.ok,
          preview,
          slice: explicit ? null : `${slice!.county}:${slice!.category}`,
          queriesRun: report.queriesRun,
          discovered: report.discovered,
          added: report.added,
          updated: report.updated,
          merged: report.duplicatesMerged,
          remaining: explicit ? 0 : Math.max(slices.length - (cursor + 1), 0),
          totalSlices: slices.length,
          elapsedMs,
          budgetExceeded: elapsedMs > 60_000,
          errors: report.errors,
        });
      },
    },
  },
});
