import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { galleryImage } from "@/lib/story-image";

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
}> {
  const db = supabaseAdmin as never as {
    from: (t: string) => any;
  };

  // 1. Release anything still marked pending that is not a picture.
  const { data: pending } = await db
    .from("digest_queue")
    .select("item_id,payload,kind")
    .eq("status", "pending")
    .in("kind", ["news", "event", "temple"])
    .limit(1000);
  const releasable = ((pending ?? []) as Record<string, unknown>[])
    .filter((r) => !isPictureRow(r))
    .map((r) => String(r["item_id"] ?? ""))
    .filter(Boolean);
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
  const batch = (queued ?? []) as Record<string, unknown>[];

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

  return { released: releasable.length, published, failed };
}
