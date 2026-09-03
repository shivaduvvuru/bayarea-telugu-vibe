import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * "Sync News Now": staff-triggered collection run.
 *
 * The hook is the same entry point the scheduled jobs call, so a manual run and
 * a cron run behave identically. It is reached over HTTP with the server-side
 * ingest token because the hook owns the whole fetch → dedupe → publish budget.
 */
export const syncNewsNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { mode?: string }) => ({
    mode:
      input?.mode === "gallery" || input?.mode === "cinema" ? (input.mode as string) : "all",
  }))
  .handler(async ({ context, data }) => {
    const { assertStaff } = await import("@/lib/cms.server");
    await assertStaff(context.supabase, context.userId);

    const { getRequest } = await import("@tanstack/react-start/server");
    const origin = new URL(getRequest().url).origin;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (col: string, v: string) => { maybeSingle: () => Promise<{ data: unknown }> };
        };
      };
    };
    const { data: row } = await db
      .from("hook_tokens")
      .select("token")
      .eq("name", "ingest")
      .maybeSingle();
    const token = (row as { token?: string } | null)?.token;
    if (!token) return { ok: false, error: "Ingest token is not configured." };

    // One broken or slow feed must not sink the run: the hook already guards
    // each source, and this call is guarded so the UI always gets a verdict.
    try {
      const response = await fetch(`${origin}/api/public/hooks/collect-news`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode: data.mode, trigger: "manual" }),
      });
      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      return { ok: response.ok, status: response.status, ...body };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
