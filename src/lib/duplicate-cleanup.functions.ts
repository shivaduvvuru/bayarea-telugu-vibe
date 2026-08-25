import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Staff-only: clear the blocked-duplicate backlog by keeping exactly one copy
 * of every story live and deleting the repeats.
 */
export const resolveDuplicates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertStaff } = await import("@/lib/cms.server");
    await assertStaff(context.supabase, context.userId);
    const { resolveDuplicateBacklog } = await import("@/lib/duplicate-cleanup.server");
    return resolveDuplicateBacklog();
  });
