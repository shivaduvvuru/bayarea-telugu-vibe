import { createServerFn } from "@tanstack/react-start";

/**
 * Minimal traffic instrumentation: one row per day, incremented once per
 * homepage render on the server. No cookies, no per-request table reads, no
 * client-side beacon — just a single counter so reader traffic can be compared
 * against scheduled-job volume.
 */
export const recordPageView = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as never as {
      rpc: (fn: string, args?: Record<string, unknown>) => Promise<unknown>;
    }).rpc("bump_page_view", {});
  } catch {
    // Counting must never affect the page.
  }
  return { ok: true };
});
