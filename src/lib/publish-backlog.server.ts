import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { galleryImage, usableImage } from "@/lib/story-image";

/**
 * Editorial rule: a news item with no usable picture is never published.
 * Events and temple notices are calendar entries, so they stay exempt.
 */
function hasArtwork(row: Record<string, unknown>): boolean {
  const kind = String(row["kind"] ?? "news");
  if (kind !== "news") return true;
  const payload = (row["payload"] ?? {}) as Record<string, unknown>;
  const image =
    (typeof payload["image"] === "string" ? (payload["image"] as string) : null) ??
    (typeof payload["image_url"] === "string" ? (payload["image_url"] as string) : null) ??
    (typeof row["image_url"] === "string" ? (row["image_url"] as string) : null);
  return !!usableImage(image);
}

/** Photo-desk rows: those wait for the picture editor, everything else goes live. */
function isPictureRow(row: Record<string, unknown>): boolean {
  const payload = (row["payload"] ?? {}) as {
    image?: string | null;
    review_type?: string | null;
    solo_verified?: string | null;
    gallery?: boolean;
  };
  return (
    !!galleryImage(payload.image ?? null) &&
    (payload.gallery === true || payload.review_type === "picture" || !!payload.solo_verified)
  );
}

/**
 * Publishes the collected backlog without an editor.
 *
 * Every non-picture item in the digest queue — Bay Area news, India, Cinema/OTT,
 * Micro-Drama, events and temple notices — is released and pushed onto the site
 * once duplicate removal at collection time has done its work. Deliberately
 * small and fast so a scheduled call always finishes: collection is the slow
 * step, this one only moves already-collected rows.
 */
export async function publishNewsBacklog(limit = 200): Promise<{
  released: number;
  published: number;
  failed: number;
  held: number;
}> {
  const db = supabaseAdmin as never as {
    from: (t: string) => any;
  };

  const { isSensitive } = await import("@/lib/auto-publish");

  // 1. Release anything still marked pending that is not a picture.
  const { data: pending } = await db
    .from("digest_queue")
    .select("item_id,payload,kind,title,summary")
    .eq("status", "pending")
    .in("kind", ["news", "event", "temple"])
    .limit(1000);
  const pendingRows = (pending ?? []) as Record<string, unknown>[];
  const plain = pendingRows.filter((r) => !isPictureRow(r));
  const idOf = (r: Record<string, unknown>) => String(r["item_id"] ?? "");
  // Sensitive stories (crime, courts, allegations, tragedy) are not a category
  // this paper publishes at all: they leave the queue instead of sitting in the
  // desk waiting for a decision that never comes.
  const sensitive = plain.filter((r) =>
    isSensitive(r["title"] as string | null, r["summary"] as string | null),
  );
  const sensitiveIds = sensitive.map(idOf).filter(Boolean);
  for (let i = 0; i < sensitiveIds.length; i += 200) {
    await db
      .from("digest_queue")
      .update({ status: "rejected", error: "sensitive category — not published" })
      .in("item_id", sensitiveIds.slice(i, i + 200));
  }
  const safe = plain.filter((r) => !sensitive.includes(r));
  const releasable = safe.filter(hasArtwork).map(idOf).filter(Boolean);
  // Imageless news never reaches the site: drop it out of the queue.
  const imageless = safe.filter((r) => !hasArtwork(r)).map(idOf).filter(Boolean);

  for (let i = 0; i < imageless.length; i += 200) {
    await db
      .from("digest_queue")
      .update({ status: "rejected", error: "no usable image" })
      .in("item_id", imageless.slice(i, i + 200));
  }
  for (let i = 0; i < releasable.length; i += 200) {
    await db
      .from("digest_queue")
      .update({ status: "approved" })
      .in("item_id", releasable.slice(i, i + 200));
  }

  // 2. Flush approved-but-unsent rows into the newsroom.
  const { data: queued } = await db
    .from("digest_queue")
    .select("*")
    .eq("status", "approved")
    .neq("upload_status", "sent")
    .order("digest_date", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 500));
  const batch = ((queued ?? []) as Record<string, unknown>[]).filter(hasArtwork);

  const { deskRowToIngest } = await import("@/lib/desk-publish.server");
  const { ingest } = await import("@/lib/cms.server");
  const { errorMessage } = await import("@/lib/error-message");

  let published = 0;
  let failed = 0;
  for (let i = 0; i < batch.length; i += 25) {
    const chunk = batch.slice(i, i + 25);
    const ids = chunk.map((r) => String(r["item_id"]));
    try {
      await ingest(chunk.map(deskRowToIngest));
      await db
        .from("digest_queue")
        .update({ upload_status: "sent", uploaded_at: new Date().toISOString(), error: null })
        .in("item_id", ids);
      published += chunk.length;
    } catch (e) {
      failed += chunk.length;
      await db
        .from("digest_queue")
        .update({ upload_status: "failed", error: errorMessage(e) })
        .in("item_id", ids);
    }
  }

  // Only a run that actually put something on the site invalidates the read
  // caches; idle ticks do no extra work.
  if (published > 0) {
    const { clearFeedCache } = await import("@/lib/cms-articles.server");
    clearFeedCache();
  }

  return { released: releasable.length, published, failed, held: sensitive.length };
}
