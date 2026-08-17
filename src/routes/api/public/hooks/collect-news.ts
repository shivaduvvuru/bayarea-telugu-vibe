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
          // Photo desks are read in rotating slices: one request cannot read all
          // ~40 desks plus their artwork inside the serverless time budget, and
          // an interrupted pass was why only a handful of pictures ever landed.
          // Intake is pushed hard: a wider slice of photo desks per pass and a
          // faster rotation window, so the whole desk list is read every few
          // minutes instead of every couple of hours.
          const sliceSize = 14;
          const baseSlice = Math.floor(Date.now() / (5 * 60 * 1000));
          let newsPool = galleryOnly ? [] : await collectAll(process.env["LOVABLE_API_KEY"]);
          let picturePool = await collectGallery(process.env["LOVABLE_API_KEY"], {
            slice: baseSlice,
            sliceSize,
          });
          // News publishes automatically, so a thin news pull is never retried
          // or reported as unhealthy — only the picture desk is gated.
          const minimumNews = 0;
          const minimumPictures = 12;

          let healthAttempts = 1;
          // Hard time budget: the retry loop used to keep re-reading the feeds
          // until the whole request was killed by the platform, which is why
          // hourly full-news runs failed and the approved backlog never flushed.
          const startedAt = Date.now();
          const withinBudget = () => Date.now() - startedAt < 90 * 1000;
          const poolCounts = () => ({
            news: newsPool.filter((r) => r.kind === "news" && !isPicture(r as unknown as Record<string, unknown>)).length,
            pictures: picturePool.filter((r) => isPicture(r as unknown as Record<string, unknown>)).length,
          });
          while (
            healthAttempts < 4 &&
            withinBudget() &&
            (poolCounts().news < minimumNews || poolCounts().pictures < minimumPictures)
          ) {
            await new Promise((resolve) => setTimeout(resolve, 300 * healthAttempts));
            const before = poolCounts();
            const [moreNews, morePictures] = await Promise.all([
              before.news < minimumNews
                ? collectAll(process.env["LOVABLE_API_KEY"])
                : Promise.resolve([]),
              // Retries advance to the next desk slice instead of re-reading the
              // same one, so a thin slice cannot starve the picture pool.
              collectGallery(process.env["LOVABLE_API_KEY"], {
                slice: baseSlice + healthAttempts,
                sliceSize,
              }),
            ]);
            newsPool = dedupeCollected([...newsPool, ...moreNews]);
            picturePool = dedupeCollected([...picturePool, ...morePictures]);
            healthAttempts += 1;
          }
          const collected = dedupeCollected([...newsPool, ...picturePool]);


          // Drop stories already stored on earlier days (same headline or article URL),
          // anything already published to the newsroom, and anything an editor rejected.
          // Paged reads: the Data API caps a single select at 1000 rows, so an
          // unpaged fetch made the duplicate memory partial and inconsistent.
          const readAll = async <T>(
            table: "digest_queue" | "content_items" | "digest_rejects",
            columns: string,
          ): Promise<T[]> => {
            const out: T[] = [];
            for (let page = 0; page < 12; page++) {
              const from = page * 1000;
              const { data, error } = await supabaseAdmin
                .from(table)
                .select(columns)
                .range(from, from + 999);
              if (error) throw error;
              const chunk = (data ?? []) as unknown as T[];
              out.push(...chunk);
              if (chunk.length < 1000) break;
            }
            return out;
          };
          const [stored, published, rejected] = await Promise.all([
            readAll<{ dedupe_key: string | null; title: string | null; source_url: string | null }>(
              "digest_queue",
              "dedupe_key, title, source_url",
            ),
            readAll<{
              title: string | null;
              link_url: string | null;
              source_ref: string | null;
              dedupe_key: string | null;
            }>("content_items", "title, link_url, source_ref, dedupe_key"),
            readAll<{ dedupe_key: string | null; item_id: string | null; title: string | null }>(
              "digest_rejects",
              "dedupe_key, item_id, title",
            ),
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
                ...(rejected ?? []).map((r) => dedupeKey(r.title ?? "")),
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
          const { isSingleWoman } = await import("@/lib/cinema-topics");
          const marked = rows.map((r) => {
            const row = r as unknown as Record<string, unknown>;
            const picture = isPicture(row);
            // Pictures: a solo female-star portrait goes straight into the
            // Glamour folder; group / unclear shots wait in the picture desk.
            const auto = picture
              ? isSingleWoman(
                  String(row["title"] ?? ""),
                  String(row["summary"] ?? ""),
                  String(row["source_url"] ?? ""),
                )
              : canAutoPublish(
                  String((r as { kind?: string }).kind ?? "news"),
                  (r as { title?: string }).title,
                  (r as { summary?: string }).summary,
                );
            return { ...r, status: auto ? "approved" : "pending" };
          });


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
            const { errorMessage } = await import("@/lib/error-message");
            // News, events and temple notices publish without editor approval,
            // so any legacy rows still sitting as "pending" are released here.
            // Photo rows are stored with kind "news" too, so they must be
            // excluded — otherwise every held picture is auto-released and the
            // picture desk always looks empty.
            {
              const { data: stillPending } = await supabaseAdmin
                .from("digest_queue")
                .select("item_id,title,summary,source_url,payload,kind")
                .eq("status", "pending")
                .in("kind", ["news", "event", "temple"])
                .limit(1000);
              const releasable = (stillPending ?? [])
                .filter((r) => !isPicture(r as unknown as Record<string, unknown>))
                .map((r) => String((r as { item_id?: string }).item_id ?? ""))
                .filter(Boolean);
              for (let i = 0; i < releasable.length; i += 200) {
                await supabaseAdmin
                  .from("digest_queue")
                  .update({ status: "approved" })
                  .in("item_id", releasable.slice(i, i + 200));
              }
            }

            // Every approved row that has not gone out yet — the ones just
            // auto-approved plus anything an editor approved in the desk.
            const { data: queued } = await supabaseAdmin
              .from("digest_queue")
              .select("*")
              .eq("status", "approved")
              .neq("upload_status", "sent")
              .limit(500);
            const batch = (queued ?? []) as unknown as Record<string, unknown>[];
            // Published in small chunks: one malformed row used to fail the
            // whole 500-row insert, so the entire approved backlog stayed stuck.
            for (let i = 0; i < batch.length; i += 25) {
              const chunk = batch.slice(i, i + 25);
              const ids = chunk.map((r) => String(r["item_id"]));
              try {
                await ingest(chunk.map(deskRowToIngest));
                await supabaseAdmin
                  .from("digest_queue")
                  .update({
                    upload_status: "sent",
                    uploaded_at: new Date().toISOString(),
                    error: null,
                  })
                  .in("item_id", ids);
                publishedCount += chunk.length;
              } catch (e) {
                const message = errorMessage(e);
                console.error("publish chunk failed", message);
                await supabaseAdmin
                  .from("digest_queue")
                  .update({ upload_status: "failed", error: message })
                  .in("item_id", ids);
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

          // Keep the Glamour folder at capacity: overflow moves to the archive,
          // and archived photos return after 15 days, most-liked first.
          let galleryRotation = { archived: 0, restored: 0, live: 0 };
          try {
            const { rotateGalleryFolder } = await import("@/lib/gallery-archive.server");
            galleryRotation = await rotateGalleryFolder(supabaseAdmin as never);
          } catch (e) {
            console.error("gallery archive rotation failed", e);
          }


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
          return Response.json({ ok: true, mode: galleryOnly ? "gallery" : "all", collected: rows.length, published: publishedCount, held: marked.length - autoIds.length, duplicatesHidden: hidden, galleryRotation, wpRemoved, intakeHealth, diag: { ...lastDiag }, aiError: lastAiError, at: finishedAt });
        } catch (e) {
          const { errorMessage } = await import("@/lib/error-message");
          const message = errorMessage(e);
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
