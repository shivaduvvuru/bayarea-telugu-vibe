import { createFileRoute } from "@tanstack/react-router";

/**
 * One-off maintenance: rewrites stored news.google.com wrapper links to the
 * real publisher URLs so story links no longer land on a Google interstitial.
 */
export const Route = createFileRoute("/api/public/repair-links")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { resolveGoogleNewsUrl } = await import("@/lib/google-news.server");

        let fixed = 0;
        let failed = 0;

        const { data: items } = await supabaseAdmin
          .from("content_items")
          .select("id, link_url")
          .like("link_url", "%news.google.com%")
          .limit(500);
        for (const row of items ?? []) {
          const real = await resolveGoogleNewsUrl(row.link_url as string);
          if (real && real !== row.link_url) {
            await supabaseAdmin.from("content_items").update({ link_url: real }).eq("id", row.id);
            fixed += 1;
          } else failed += 1;
        }

        const { data: queue } = await supabaseAdmin
          .from("digest_queue")
          .select("item_id, source_url")
          .like("source_url", "%news.google.com%")
          .limit(500);
        for (const row of queue ?? []) {
          const real = await resolveGoogleNewsUrl(row.source_url as string);
          if (real && real !== row.source_url) {
            await supabaseAdmin.from("digest_queue").update({ source_url: real }).eq("item_id", row.item_id);
            fixed += 1;
          } else failed += 1;
        }

        return Response.json({ fixed, failed });
      },
    },
  },
});
