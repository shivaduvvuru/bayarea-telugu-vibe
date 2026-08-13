import { createFileRoute } from "@tanstack/react-router";

/**
 * One-off maintenance: published stories collected before link unwrapping have
 * no artwork. Now that link_url points at the publisher, re-read each page's
 * og:image and store it (credited to the publisher in the UI).
 *
 *   POST /api/public/hooks/backfill-images
 *   apikey: <publishable key>
 */
export const Route = createFileRoute("/api/public/hooks/backfill-images")({
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

        const { fetchArticleImage } = await import("@/lib/collect-news.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data, error } = await supabaseAdmin
          .from("content_items")
          .select("id, link_url")
          .eq("status", "published")
          .is("image_url", null)
          .not("link_url", "is", null)
          .limit(60);
        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        let updated = 0;
        for (const row of data ?? []) {
          const image = row.link_url ? await fetchArticleImage(row.link_url) : null;
          if (!image) continue;
          const res = await supabaseAdmin
            .from("content_items")
            .update({ image_url: image })
            .eq("id", row.id);
          if (!res.error) updated += 1;
        }

        // Also fill artwork on queue rows still awaiting review, so approved
        // picture stories publish with their photo attached.
        const { data: queued } = await supabaseAdmin
          .from("digest_queue")
          .select("item_id, source_url, payload")
          .eq("status", "pending")
          .not("source_url", "is", null)
          .limit(80);
        let queueUpdated = 0;
        for (const row of queued ?? []) {
          const payload = (row.payload ?? {}) as Record<string, unknown>;
          if (payload["image_url"]) continue;
          const image = row.source_url ? await fetchArticleImage(row.source_url) : null;
          if (!image) continue;
          const res = await supabaseAdmin
            .from("digest_queue")
            .update({ payload: { ...payload, image_url: image } })
            .eq("item_id", row.item_id);
          if (!res.error) queueUpdated += 1;
        }

        return Response.json({
          ok: true,
          scanned: (data ?? []).length,
          updated,
          queueScanned: (queued ?? []).length,
          queueUpdated,
        });

      },
    },
  },
});
