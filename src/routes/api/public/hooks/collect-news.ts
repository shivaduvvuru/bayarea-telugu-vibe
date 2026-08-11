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

        const { collectAll, dedupeCollected, urlKey } = await import("@/lib/collect-news.server");
        const { dedupeKey } = await import("@/lib/dedupe");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        try {
          const collected = await collectAll(process.env["LOVABLE_API_KEY"]);

          // Drop stories already stored on earlier days (same headline or article URL)
          // and anything already published to the newsroom.
          const [{ data: stored }, { data: published }] = await Promise.all([
            supabaseAdmin.from("digest_queue").select("dedupe_key, title, source_url").limit(5000),
            supabaseAdmin
              .from("content_items")
              .select("title, link_url, source_ref, dedupe_key")
              .limit(5000),
          ]);
          const storedKeys = new Set([
            ...(stored ?? []).map((r) => r.dedupe_key ?? ""),
            ...(published ?? []).map((r) => r.dedupe_key ?? ""),
            // desk rows publish as source_ref "editorial-desk:<item_id>"
            ...(published ?? []).map((r) => (r.source_ref ?? "").replace(/^editorial-desk:/, "")),
          ]);
          const rows = dedupeCollected(
            collected.filter(
              (r) => !storedKeys.has(r.dedupe_key) && !storedKeys.has(String(r.item_id ?? "")),
            ),
            {
              titles: [
                ...(stored ?? []).map((r) => dedupeKey(r.title ?? "")),
                ...(published ?? []).map((r) => dedupeKey(r.title ?? "")),
              ],
              urls: [
                ...(stored ?? []).map((r) => (r.source_url ? urlKey(r.source_url) : "")),
                ...(published ?? []).map((r) => (r.link_url ? urlKey(r.link_url) : "")),
              ],
            },
          );

          if (rows.length) {
            const { error } = await supabaseAdmin
              .from("digest_queue")
              .upsert(rows as never, { onConflict: "dedupe_key", ignoreDuplicates: false });
            if (error) throw error;
          }

          // 7-day rolling window
          const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
          await supabaseAdmin.from("digest_queue").delete().lt("digest_date", cutoff);

          const { lastAiError, lastDiag } = await import("@/lib/collect-news.server");
          return Response.json({ ok: true, collected: rows.length, diag: { ...lastDiag }, aiError: lastAiError, at: new Date().toISOString() });
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
