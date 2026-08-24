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
          mode?: unknown;
        };
        const asList = (value: unknown) =>
          Array.isArray(value) ? value.slice(0, 12).map(String) : [];
        const counties = asList(body.counties);
        const categories = asList(body.categories);
        const preview = body.preview === true;
        const burst = body.mode === "burst";
        const maxQueries = burst
          ? Math.min(Math.max(Number(body.maxQueries ?? 50) || 50, 1), 50)
          : Math.min(Math.max(Number(body.maxQueries ?? 10) || 10, 1), 10);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { ingestDirectoryFromOsm } = await import("@/lib/directory-osm.server");
        const { directorySlices, readSliceCursor, writeSliceCursor } = await import(
          "@/lib/directory-slices.server"
        );

        const slices = directorySlices();
        const explicit = counties.length > 0 || categories.length > 0;
        const startedAt = Date.now();
        const BUDGET_MS = 60_000;

        const totals = {
          queriesRun: 0,
          discovered: 0,
          added: 0,
          updated: 0,
          merged: 0,
          errors: [] as string[],
        };
        const slicesRun: string[] = [];
        let cursor = 0;
        let ok = true;

        const runOne = async (opts: { counties?: string[] | undefined; categories?: string[] | undefined; cap: number }) => {
          const report = await ingestDirectoryFromOsm(supabaseAdmin as never, {
            counties: opts.counties,
            categories: opts.categories,
            maxQueries: opts.cap,
            preview,
          });
          totals.queriesRun += report.queriesRun;
          totals.discovered += report.discovered;
          totals.added += report.added;
          totals.updated += report.updated;
          totals.merged += report.duplicatesMerged;
          if (report.errors?.length) totals.errors.push(...report.errors);
          if (!report.ok) ok = false;
        };

        try {
          if (explicit) {
            await runOne({
              counties: counties.length ? counties : undefined,
              categories: categories.length ? categories : undefined,
              cap: maxQueries,
            });
          } else {
            cursor = (await readSliceCursor(supabaseAdmin as never)) % slices.length;
            let index = cursor;
            do {
              const slice = slices[index % slices.length]!;
              const remainingQueries = maxQueries - totals.queriesRun;
              if (remainingQueries <= 0) break;
              await runOne({
                counties: [slice.county],
                categories: [slice.category],
                cap: burst ? Math.min(remainingQueries, 10) : remainingQueries,
              });
              slicesRun.push(`${slice.county}:${slice.category}`);
              index += 1;
              if (!preview) {
                await writeSliceCursor(
                  supabaseAdmin as never,
                  index,
                  slices.length,
                  `${slice.county}:${slice.category}`,
                );
              }
            } while (burst && Date.now() - startedAt < BUDGET_MS && totals.queriesRun < maxQueries);
          }
        } catch (error) {
          return Response.json(
            {
              ok: false,
              error: error instanceof Error ? error.message : "Ingest failed",
              ...totals,
              slices: slicesRun,
            },
            { status: 500 },
          );
        }

        const elapsedMs = Date.now() - startedAt;

        return Response.json({
          ok,
          preview,
          mode: burst ? "burst" : "slice",
          slice: explicit ? null : (slicesRun[0] ?? null),
          slices: explicit ? null : slicesRun,
          queriesRun: totals.queriesRun,
          discovered: totals.discovered,
          added: totals.added,
          updated: totals.updated,
          merged: totals.merged,
          remaining: explicit ? 0 : Math.max(slices.length - (cursor + slicesRun.length), 0),
          totalSlices: slices.length,
          elapsedMs,
          budgetExceeded: elapsedMs > BUDGET_MS,
          errors: totals.errors,
        });

      },
    },
  },
});
