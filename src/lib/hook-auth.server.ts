import { deskUnlocked } from "@/lib/desk-session.server";

/**
 * Ingest hooks are privileged: they run with the service-role client and can
 * publish or delete content. Callers must prove one of:
 *  - a scheduled-job token (Authorization: Bearer <token>) stored server-side
 *    in public.hook_tokens, readable only by the service role / scheduler;
 *  - an unlocked editorial-desk session cookie (manual "refresh now" buttons).
 *
 * The Supabase publishable key is NOT accepted — it ships to every browser.
 */
export async function hookAuthorized(request: Request): Promise<boolean> {
  const presented = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")?.trim();
  if (presented) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("hook_tokens")
      .select("token")
      .eq("name", "ingest")
      .maybeSingle();
    const expected = (data as { token?: string } | null)?.token;
    if (expected && presented.length === expected.length && presented === expected) return true;
  }
  return deskUnlocked();
}

export function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
