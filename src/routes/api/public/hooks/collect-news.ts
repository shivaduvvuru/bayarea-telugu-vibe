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
        const { hookAuthorized, unauthorized } = await import("@/lib/hook-auth.server");
        if (!(await hookAuthorized(request))) return unauthorized();

        const { collectAll, collectGallery, dedupeCollected, urlKey } = await import(
          "@/lib/collect-news.server"
        );
        // { "mode": "gallery" } runs only the star / photo desks (3-hourly job).
        const body = (await request.json().catch(() => ({}))) as {
          mode?: string;
          trigger?: string;
        };
        const galleryOnly = body?.mode === "gallery";
        const trigger = body?.trigger === "manual" ? "manual" : "cron";
        const { dedupeKey } = await import("@/lib/dedupe");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        try {
          // A full pull also sweeps the picture desks, so Glamourie photos land
          // in the review queue alongside the day's stories.
          const { isStarGallery } = await import("@/lib/cinema-topics");
          const { galleryImage } = await import("@/lib/story-image");
          const isPicture = (r: Record<string, unknown>) => {
            const image = (r["payload"] as { image?: string | null } | undefined)?.image ?? null;
            return (
              !!galleryImage(image) &&
              isStarGallery(
                String(r["title"] ?? ""),
                String(r["summary"] ?? ""),
                String(r["source_url"] ?? ""),
              )
            );
          };

          // Intake health gate: do not send a starved pull to the approval
          // stage. Retry only the deficient source pool, with short backoff,
          // and merge all attempts before the normal duplicate checks.
          let newsPool = galleryOnly ? [] : await collectAll(process.env["LOVABLE_API_KEY"]);
          let picturePool = await collectGallery(process.env["LOVABLE_API_KEY"]);
          const minimumNews = galleryOnly ? 0 : 12;
          const minimumPictures = 8;
          let healthAttempts = 1;
          const poolCounts = () => ({
            news: newsPool.filter((r) => r.kind === "news" && !isPicture(r as unknown as Record<string, unknown>)).length,
            pictures: picturePool.filter((r) => isPicture(r as unknown as Record<string, unknown>)).length,
          });
          while (
            healthAttempts < 3 &&
            (poolCounts().news < minimumNews || poolCounts().pictures < minimumPictures)
          ) {
            await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (healthAttempts - 1)));
            const before = poolCounts();
            const [moreNews, morePictures] = await Promise.all([
              before.news < minimumNews
                ? collectAll(process.env["LOVABLE_API_KEY"])
                : Promise.resolve([]),
              before.pictures < minimumPictures
                ? collectGallery(process.env["LOVABLE_API_KEY"])
                : Promise.resolve([]),
            ]);
            newsPool = dedupeCollected([...newsPool, ...moreNews]);
            picturePool = dedupeCollected([...picturePool, ...morePictures]);
            healthAttempts += 1;
          }
          const collected = dedupeCollected([...newsPool, ...picturePool]);


          // Drop stories already stored on earlier days (same headline or article URL),
          // anything already published to the newsroom, and anything an editor rejected.
          const [{ data: stored }, { data: published }, { data: rejected }] = await Promise.all([
            supabaseAdmin.from("digest_queue").select("dedupe_key, title, source_url").limit(5000),
            supabaseAdmin
              .from("content_items")
              .select("title, link_url, source_ref, dedupe_key")
              .limit(5000),
            supabaseAdmin.from("digest_rejects").select("dedupe_key, item_id, title").limit(5000),
          ]);
          const storedKeys = new Set([
            ...(stored ?? []).map((r) => r.dedupe_key ?? ""),
            ...(published ?? []).map((r) => r.dedupe_key ?? ""),
            ...(rejected ?? []).map((r) => r.dedupe_key ?? ""),
            ...(rejected ?? []).map((r) => r.item_id ?? ""),
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
            status:
              !isPicture(r as unknown as Record<string, unknown>) &&
              canAutoPublish(
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
              // Never rewrite an existing row's editorial decision or sent
              // state when a source repeats it in a later pull.
              .upsert(marked as never, { onConflict: "dedupe_key", ignoreDuplicates: true });
            if (error) throw error;
          }

          // Push the freshly approved rows straight onto the site.
          let publishedCount = 0;
          const autoIds = marked
            .filter((r) => r.status === "approved")
            .map((r) => String((r as { item_id?: string }).item_id ?? ""))
            .filter(Boolean);
          {
            const { deskRowToIngest } = await import("@/lib/desk-publish.server");
            const { ingest } = await import("@/lib/cms.server");
            // Every approved row that has not gone out yet — the ones just
            // auto-approved plus anything an editor approved in the desk.
            const { data: queued } = await supabaseAdmin
              .from("digest_queue")
              .select("*")
              .eq("status", "approved")
              .neq("upload_status", "sent")
              .limit(500);
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

          // Mirror the WordPress site: anything unpublished there disappears here.
          let wpRemoved = 0;
          if (!galleryOnly) {
            try {
              const { fetchWordPressPosts, syncWordPressRemovals } = await import(
                "@/lib/wp-source.server"
              );
              wpRemoved = await syncWordPressRemovals(
                supabaseAdmin as never,
                await fetchWordPressPosts(300),
              );
            } catch (e) {
              console.error("wordpress removal sync failed", e);
            }
          }

          // Regular duplicate sweep across the published site.
          const { sweepDuplicates } = await import("@/lib/dedupe-sweep.server");
          const hidden = await sweepDuplicates(supabaseAdmin as never);

          // Verify the actual approval backlog after ingestion. This is the
          // authoritative check the desk uses to distinguish a genuinely
          // empty queue from a temporary read/display failure.
          const { data: pendingRows, error: pendingError } = await supabaseAdmin
            .from("digest_queue")
            .select("title,summary,source_url,payload,kind")
            .eq("status", "pending")
            .gte("digest_date", cutoff)
            .limit(1000);
          if (pendingError) throw pendingError;
          const pendingPictures = (pendingRows ?? []).filter((r) =>
            isPicture(r as unknown as Record<string, unknown>),
          ).length;
          const pendingNews = (pendingRows ?? []).filter(
            (r) => r.kind === "news" && !isPicture(r as unknown as Record<string, unknown>),
          ).length;
          const intakeHealth = {
            attempts: healthAttempts,
            pool: poolCounts(),
            pending: { news: pendingNews, pictures: pendingPictures },
            healthy:
              poolCounts().news >= minimumNews && poolCounts().pictures >= minimumPictures,
          };


          const { lastAiError, lastDiag } = await import("@/lib/collect-news.server");
          const finishedAt = new Date().toISOString();
          // Status log so the site can show when the last pull completed.
          await supabaseAdmin.from("collect_runs").insert({
            mode: galleryOnly ? "gallery" : "all",
            trigger,
            collected: rows.length,
            published: publishedCount,
            held: marked.length - autoIds.length,
            duplicates_hidden: hidden,
            ok: true,
            finished_at: finishedAt,
          } as never);
          return Response.json({ ok: true, mode: galleryOnly ? "gallery" : "all", collected: rows.length, published: publishedCount, held: marked.length - autoIds.length, duplicatesHidden: hidden, wpRemoved, intakeHealth, diag: { ...lastDiag }, aiError: lastAiError, at: finishedAt });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          console.error("collect-news failed", message);
          try {
            await supabaseAdmin
              .from("collect_runs")
              .insert({ mode: galleryOnly ? "gallery" : "all", trigger, ok: false, error: message } as never);
          } catch {
            /* status logging must never mask the original failure */
          }
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
