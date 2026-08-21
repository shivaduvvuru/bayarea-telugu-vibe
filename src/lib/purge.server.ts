/**
 * Permanent deletion for editor "dislike" actions.
 *
 * A dislike from a signed-in editor is final: the item is deleted from the
 * ingestion tables, any published copy is removed from the site, and its keys
 * are remembered in digest_rejects so a later collection pass never brings it
 * back.
 */

type Db = Awaited<ReturnType<typeof adminDb>>;

async function adminDb() {
  const { admin } = await import("@/lib/cms.server");
  return admin();
}

async function remember(db: Db, keys: string[], itemId: string | null, title: string | null) {
  const unique = [...new Set(keys.filter((k) => typeof k === "string" && k.length > 0))];
  if (!unique.length) return;
  await db.from("digest_rejects").upsert(
    unique.map((dedupe_key) => ({
      dedupe_key,
      item_id: itemId,
      title,
      reason: "editor_dislike",
    })) as never,
    { onConflict: "dedupe_key", ignoreDuplicates: true },
  );
}

/** Hard-delete published content rows (and anything that points at them). */
async function deleteContentItems(db: Db, ids: string[]) {
  if (!ids.length) return;
  await db.from("saved_items").delete().in("content_item_id", ids);
  await db.from("content_item_contacts").delete().in("content_item_id", ids);
  await db.from("content_items").update({ duplicate_of: null }).in("duplicate_of", ids);
  await db.from("raw_ingestion_items").update({ published_content_item_id: null }).in("published_content_item_id", ids);
  await db.from("content_items").delete().in("id", ids);
}

/** Editor dislike on a review-queue story. */
export async function purgeRawItems(ids: string[]): Promise<{ ok: boolean; deleted: number; error: string | null }> {
  if (!ids.length) return { ok: true, deleted: 0, error: null };
  const db = await adminDb();

  const { data: rows } = await db
    .from("raw_ingestion_items")
    .select("id, dedupe_key, canonical_url, image_url, original_title, published_content_item_id")
    .in("id", ids);

  const list = (rows ?? []) as Array<{
    id: string;
    dedupe_key: string | null;
    canonical_url: string | null;
    image_url: string | null;
    original_title: string | null;
    published_content_item_id: string | null;
  }>;

  for (const row of list) {
    await remember(db, [row.dedupe_key ?? "", row.canonical_url ?? ""], row.id, row.original_title);
  }

  // Remove published copies: by id, and by source link/image in case the story
  // was published from a different row.
  await deleteContentItems(
    db,
    list.map((row) => row.published_content_item_id).filter((id): id is string => Boolean(id)),
  );
  const links = list.map((row) => row.canonical_url).filter((u): u is string => Boolean(u));
  if (links.length) {
    const { data: matched } = await db.from("content_items").select("id").in("link_url", links);
    await deleteContentItems(db, ((matched ?? []) as Array<{ id: string }>).map((m) => m.id));
  }

  const keys = list.flatMap((row) => [row.dedupe_key, row.canonical_url]).filter((k): k is string => Boolean(k));
  if (keys.length) await db.from("digest_queue").delete().in("dedupe_key", keys);

  await db.from("editorial_reviews").delete().in("raw_item_id", ids);
  const { error } = await db.from("raw_ingestion_items").delete().in("id", ids);
  return { ok: !error, deleted: error ? 0 : list.length, error: error?.message ?? null };
}

/** Editor dislike on a picture in the picture desk. */
export async function purgePictureItems(itemIds: string[]): Promise<{ ok: boolean; deleted: number; error: string | null }> {
  if (!itemIds.length) return { ok: true, deleted: 0, error: null };
  const db = await adminDb();

  const { data: rows } = await db
    .from("picture_intake")
    .select("item_id, dedupe_key, queue_item_id, image_url, source_url, title")
    .in("item_id", itemIds);

  const list = (rows ?? []) as Array<{
    item_id: string;
    dedupe_key: string | null;
    queue_item_id: string | null;
    image_url: string | null;
    source_url: string | null;
    title: string | null;
  }>;

  for (const row of list) {
    await remember(
      db,
      [row.dedupe_key ?? "", row.image_url ?? "", row.source_url ?? ""],
      row.item_id,
      row.title,
    );
  }

  const images = list.map((row) => row.image_url).filter((u): u is string => Boolean(u));
  if (images.length) {
    const { data: matched } = await db.from("content_items").select("id").in("image_url", images);
    await deleteContentItems(db, ((matched ?? []) as Array<{ id: string }>).map((m) => m.id));
  }

  const keys = list
    .flatMap((row) => [row.dedupe_key, row.image_url, row.source_url, row.queue_item_id])
    .filter((k): k is string => Boolean(k));
  if (keys.length) {
    await db.from("digest_queue").delete().in("dedupe_key", keys);
    await db.from("digest_queue").delete().in("item_id", keys);
  }

  const { error } = await db.from("picture_intake").delete().in("item_id", itemIds);
  return { ok: !error, deleted: error ? 0 : list.length, error: error?.message ?? null };
}
