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

          // Temple notices, events and ordinary news publish without an editor.
          // Only sensitive news stays pending in the review desk.
          const { canAutoPublish } = await import("@/lib/auto-publish");
          const marked = rows.map((r) => ({
            ...r,
            status: canAutoPublish(
              String((r as { kind?: string }).kind ?? "news"),
              (r as { title?: string }).title,
              (r as { summary?: string }).summary,
            )
              ? "approved"
              : "pending",
          }));

          if (marked.length) {
            const { error } = await supabaseAdmin
              .from("digest_queue")
              .upsert(marked as never, { onConflict: "dedupe_key", ignoreDuplicates: false });
            if (error) throw error;
          }

          // Push the freshly approved rows straight onto the site.
          let publishedCount = 0;
          const autoIds = marked
            .filter((r) => r.status === "approved")
            .map((r) => String((r as { item_id?: string }).item_id ?? ""))
            .filter(Boolean);
          if (autoIds.length) {
            const { deskRowToIngest } = await import("@/lib/desk-publish.server");
            const { ingest } = await import("@/lib/cms.server");
            const { data: queued } = await supabaseAdmin
              .from("digest_queue")
              .select("*")
              .in("item_id", autoIds)
              .eq("status", "approved")
              .neq("upload_status", "sent");
            const batch = (queued ?? []) as unknown as Record<string, unknown>[];
            if (batch.length) {
              try {
                await ingest(batch.map(deskRowToIngest));
                await supabaseAdmin
                  .from("digest_queue")
                  .update({
                    upload_status: "sent",
                    uploaded_at: new Date().toISOString(),
                    error: null,
                  })
                  .in(
                    "item_id",
                    batch.map((r) => String(r["item_id"])),
                  );
                publishedCount = batch.length;
              } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                await supabaseAdmin
                  .from("digest_queue")
                  .update({ upload_status: "failed", error: message })
                  .in(
                    "item_id",
                    batch.map((r) => String(r["item_id"])),
                  );
              }
            }
          }

          // 7-day rolling window
          const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
          await supabaseAdmin.from("digest_queue").delete().lt("digest_date", cutoff);

          // Regular duplicate sweep across the published site.
          const { sweepDuplicates } = await import("@/lib/dedupe-sweep.server");
          const hidden = await sweepDuplicates(supabaseAdmin as never);

          const { lastAiError, lastDiag } = await import("@/lib/collect-news.server");
          return Response.json({ ok: true, collected: rows.length, published: publishedCount, held: marked.length - autoIds.length, duplicatesHidden: hidden, diag: { ...lastDiag }, aiError: lastAiError, at: new Date().toISOString() });
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
