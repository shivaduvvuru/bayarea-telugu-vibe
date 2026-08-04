import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Staff-only live health report for every ingestion source. */
export const getSourceHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertStaff } = await import("@/lib/cms.server");
    await assertStaff(context.supabase, context.userId);
    const { buildHealthReport } = await import("@/lib/health.server");
    return buildHealthReport();
  });