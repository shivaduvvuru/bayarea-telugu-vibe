import { createFileRoute } from "@tanstack/react-router";

/**
 * Collects fresh Bay Area news/events/temple items and upserts them into the
 * digest queue. Called by the 3-hourly scheduled job (and the "Refresh now"
 * button). Existing rows keep their review decisions — only content refreshes.
 */
export const Route = createFileRoute("/api/public/hooks/collect-news")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const expected =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ??
          process.env["SUPABASE_ANON_KEY"] ??
          (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined);

        if (!key || !expected || key !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { collectAll } = await import("@/lib/collect-news.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        try {
          const rows = await collectAll(process.env["LOVABLE_API_KEY"]);
          if (rows.length) {
            const { error } = await supabaseAdmin
              .from("digest_queue")
              .upsert(rows as never, { onConflict: "dedupe_key", ignoreDuplicates: false });
            if (error) throw error;
          }

          // 7-day rolling window
          const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
          await supabaseAdmin.from("digest_queue").delete().lt("digest_date", cutoff);

          const { lastAiError } = await import("@/lib/collect-news.server");
          return Response.json({ ok: true, collected: rows.length, aiError: lastAiError, at: new Date().toISOString() });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          console.error("collect-news failed", message);
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
