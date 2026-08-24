import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Staff-only ingest health report: sections, sources and schedules. */
export const getIngestHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertStaff } = await import("@/lib/cms.server");
    await assertStaff(context.supabase, context.userId);
    const { buildIngestHealth } = await import("@/lib/health-audit.server");
    return buildIngestHealth();
  });

/** Runs one India publisher (or the whole desk) on demand. */
export const runIngestSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { source?: string }) => ({
    source: input?.source ? String(input.source).slice(0, 200) : undefined,
  }))
  .handler(async ({ context, data }) => {
    const { assertStaff } = await import("@/lib/cms.server");
    await assertStaff(context.supabase, context.userId);
    const { runIndiaIngest } = await import("@/lib/india-ingest.server");
    return runIndiaIngest({
      ...(data.source ? { source: data.source } : {}),
      trigger: "manual",
      budgetMs: 60_000,
    });
  });

/** Confirms the alert channel end to end. */
export const sendTestAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertStaff } = await import("@/lib/cms.server");
    await assertStaff(context.supabase, context.userId);
    const { sendPushover } = await import("@/lib/pushover.server");
    const push = await sendPushover({
      title: "TBA ingest alert",
      message: "Test alert from Times Bay Area — alerting is working.",
      priority: 0,
    });
    return { ok: push.ok, status: push.status, body: push.body };
  });

/** Runs the daily audit immediately (retry + alert only if flagged). */
export const runAuditNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertStaff } = await import("@/lib/cms.server");
    await assertStaff(context.supabase, context.userId);
    const { runDailyAudit } = await import("@/lib/health-audit.server");
    const result = await runDailyAudit();
    return { notified: result.notified, retried: result.retried, issues: result.report.issues };
  });
