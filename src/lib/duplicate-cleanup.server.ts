/**
 * Duplicate backlog resolver.
 *
 * Editorial rule: one story per event. For every group of blocked repeats we
 * keep exactly one copy live and remove the rest permanently:
 *
 *  - the group's original is still live  -> delete every repeat
 *  - the original is gone / not published -> promote the best repeat (image
 *    first, then newest) to `published` and delete its siblings
 */

type Db = Awaited<ReturnType<typeof adminDb>>;

async function adminDb() {
  const { admin } = await import("@/lib/cms.server");
  return admin();
}

type Row = {
  id: string;
  status: string;
  duplicate_of: string | null;
  image_url: string | null;
  created_at: string;
  published_at: string | null;
};

async function hardDelete(db: Db, ids: string[]) {
  if (!ids.length) return;
  await db.from("saved_items").delete().in("content_item_id", ids);
  await db.from("content_item_contacts").delete().in("content_item_id", ids);
  await db.from("content_items").update({ duplicate_of: null }).in("duplicate_of", ids);
  await db
    .from("raw_ingestion_items")
    .update({ published_content_item_id: null })
    .in("published_content_item_id", ids);
  await db.from("content_items").delete().in("id", ids);
}

function best(rows: Row[]): Row {
  return [...rows].sort((a, b) => {
    const img = Number(Boolean(b.image_url)) - Number(Boolean(a.image_url));
    if (img !== 0) return img;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  })[0]!;
}

export async function resolveDuplicateBacklog(): Promise<{
  reviewed: number;
  promoted: number;
  deleted: number;
}> {
  const db = await adminDb();

  const { data, error } = await db
    .from("content_items")
    .select("id, status, duplicate_of, image_url, created_at, published_at")
    .eq("status", "duplicate")
    .limit(2000);
  if (error) throw new Error(error.message);
  const dupes = (data ?? []) as Row[];
  if (!dupes.length) return { reviewed: 0, promoted: 0, deleted: 0 };

  // Group by the original each repeat points at; orphans form their own group.
  const groups = new Map<string, Row[]>();
  for (const row of dupes) {
    const key = row.duplicate_of ?? `self:${row.id}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const originalIds = [...groups.keys()].filter((k) => !k.startsWith("self:"));
  const live = new Set<string>();
  if (originalIds.length) {
    const { data: origs } = await db
      .from("content_items")
      .select("id, status")
      .in("id", originalIds);
    for (const o of (origs ?? []) as { id: string; status: string }[]) {
      if (o.status === "published") live.add(o.id);
    }
  }

  const toDelete: string[] = [];
  const toPromote: string[] = [];
  for (const [key, rows] of groups) {
    if (live.has(key)) {
      toDelete.push(...rows.map((r) => r.id));
      continue;
    }
    // Nothing live for this story: keep the strongest repeat, drop the rest.
    const keeper = best(rows);
    toPromote.push(keeper.id);
    toDelete.push(...rows.filter((r) => r.id !== keeper.id).map((r) => r.id));
  }

  if (toPromote.length) {
    const now = new Date().toISOString();
    for (let i = 0; i < toPromote.length; i += 100) {
      const slice = toPromote.slice(i, i + 100);
      await db
        .from("content_items")
        .update({ status: "published", duplicate_of: null, published_at: now })
        .in("id", slice);
    }
  }

  for (let i = 0; i < toDelete.length; i += 100) {
    await hardDelete(db, toDelete.slice(i, i + 100));
  }

  return { reviewed: dupes.length, promoted: toPromote.length, deleted: toDelete.length };
}
