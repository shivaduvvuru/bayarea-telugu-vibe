import { createFileRoute } from "@tanstack/react-router";

/**
 * Dedicated Cinema/OTT + micro-drama ingest job.
 *
 * Runs the two desks sequentially, each with its own budget, and writes a single
 * `collect_runs` row. If another cinema run is still open the hook returns
 * { skipped: "in_progress" } instead of starting a second overlapping run.
 * Hard budget of 240 s: whatever finished is returned with partial: true.
 */
export const Route = createFileRoute("/api/public/hooks/collect-cinema")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { hookAuthorized, unauthorized } = await import("@/lib/hook-auth.server");
        if (!(await hookAuthorized(request))) return unauthorized();

        const body = (await request.json().catch(() => ({}))) as { trigger?: string };
        const trigger = body?.trigger === "manual" ? "manual" : "cron";

        const { cinemaRunInProgress, openCinemaRun, closeCinemaRun, runDeskIngest } = await import(
          "@/lib/collect-cinema.server"
        );
        const { errorMessage } = await import("@/lib/error-message");

        if (await cinemaRunInProgress()) {
          return Response.json({ ok: true, skipped: "in_progress" });
        }

        const HARD_BUDGET_MS = 240_000;
        const startedAt = Date.now();
        const runId = await openCinemaRun(trigger);
        const desks = ["cinema", "micro-drama"] as const;
        const results: unknown[] = [];
        let partial = false;
        let collected = 0;
        let published = 0;
        let held = 0;

        try {
          for (const desk of desks) {
            const remaining = HARD_BUDGET_MS - (Date.now() - startedAt);
            // A desk needs fetch time plus a publish window; below that, stop and
            // report what completed rather than getting cut off mid-write.
            if (remaining < 45_000) {
              partial = true;
              break;
            }
            const deadlineMs = Math.min(desk === "cinema" ? 90_000 : 45_000, remaining - 25_000);
            const result = await runDeskIngest(desk, {
              deadlineMs: Math.max(deadlineMs, 10_000),
              publishCutoffMs: Math.max(remaining - 15_000, 20_000),
            });
            results.push(result);
            collected += result.queued;
            published += result.published;
            held += result.held;
          }
          if (Date.now() - startedAt > HARD_BUDGET_MS) partial = true;

          const funnel = { partial, desks: results, elapsedMs: Date.now() - startedAt };
          await closeCinemaRun(runId, { collected, published, held, funnel, ok: true });
          return Response.json({
            ok: true,
            mode: "cinema-job",
            trigger,
            partial,
            collected,
            published,
            held,
            desks: results,
            elapsedMs: Date.now() - startedAt,
            at: new Date().toISOString(),
          });
        } catch (e) {
          const message = errorMessage(e);
          console.error("collect-cinema failed", message);
          await closeCinemaRun(runId, {
            collected,
            published,
            held,
            funnel: { partial: true, desks: results },
            ok: false,
            error: message,
          }).catch(() => undefined);
          return Response.json({ ok: false, error: message, desks: results }, { status: 500 });
        }
      },
    },
  },
});
