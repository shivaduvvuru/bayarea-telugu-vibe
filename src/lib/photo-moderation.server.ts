import { admin } from "@/lib/cms.server";

/**
 * Photo removal on dislike. A disliked picture is pulled from the newsroom for
 * everyone (status "removed", placement "hidden") so it cannot come back on a
 * later refresh or collection pass. Any reader's dislike deletes the picture —
 * the site's rule is that a dislike removes the item site-wide.
 */
export async function removePhoto(slug: string): Promise<{ removed: boolean; reason?: string }> {
  const id = slug.startsWith("c-") ? slug.slice(2) : slug;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { removed: false, reason: "unknown" };


  const db = await admin();
  const { data: row } = await db
    .from("content_items")
    .select("image_url, dedupe_key, title, link_url")
    .eq("id", id)
    .maybeSingle();

  const { error } = await db
    .from("content_items")
    .update({ status: "removed", placement: "hidden" })
    .eq("id", id);
  if (error) return { removed: false, reason: error.message };

  const meta = row as {
    image_url?: string | null;
    dedupe_key?: string | null;
    title?: string | null;
    link_url?: string | null;
  } | null;

  // Same picture reused on another row (feeds often repeat artwork): pull those
  // too so the image never reappears.
  const image = meta?.image_url;
  if (image) {
    await db
      .from("content_items")
      .update({ status: "removed", placement: "hidden" })
      .eq("image_url", image)
      .neq("id", id);
  }

  // Drop it from the review queue and remember the keys, so a later collection
  // pass treats the picture as rejected instead of bringing it back.
  const keys = [meta?.dedupe_key, image, meta?.link_url].filter(
    (k): k is string => typeof k === "string" && k.length > 0,
  );
  if (keys.length) {
    await db.from("digest_queue").delete().in("dedupe_key", keys);
    await db.from("digest_rejects").upsert(
      keys.map((k) => ({ dedupe_key: k, item_id: id, title: meta?.title ?? null })) as never,
      { onConflict: "dedupe_key", ignoreDuplicates: true },
    );
  }

  return { removed: true };
}

