/**
 * Duplicate detection and merge workflow for the restaurant directory.
 *
 * Detection runs on every read (see `collapseDuplicates` in food.server.ts) so
 * readers never see the same restaurant twice. This module powers the editorial
 * side: it lists the detected groups and merges them permanently — ratings,
 * community reviews and deals move to the surviving listing, and the duplicates
 * are marked `merged` so they leave every public query.
 */

import { RESTAURANT_COLUMNS, groupDuplicates, type Restaurant } from "@/lib/food";

type Client = { from: (table: string) => any };

export type DupeGroup = {
  primary: Restaurant;
  duplicates: Restaurant[];
  reason: string;
};

/** How complete a listing is — the richest row survives a merge. */
export function completeness(r: Restaurant): number {
  return (
    (r.verified ? 40 : 0) +
    (r.sponsored ? 10 : 0) +
    (r.address ? 8 : 0) +
    (r.phone ? 5 : 0) +
    (r.website_url ? 5 : 0) +
    (r.menu_url ? 4 : 0) +
    (r.hours && Object.keys(r.hours).length > 0 ? 6 : 0) +
    (r.latitude != null ? 4 : 0) +
    r.photos.length +
    r.cuisines.length +
    r.dish_tags.length
  );
}

function describe(rows: Restaurant[]): string {
  const cities = new Set(rows.map((r) => r.city ?? "unknown"));
  const names = new Set(rows.map((r) => r.name.toLowerCase()));
  if (cities.size === 1 && names.size > 1) return "Same restaurant listed under different names";
  if (new Set(rows.map((r) => r.website_url ?? "")).size === 1) return "Same website and city";
  if (cities.size > 1) return "Same brand and address across city labels";
  return "Same name and city";
}

/** Detected duplicate groups among published listings, richest row first. */
export async function findDuplicateGroups(db: Client): Promise<DupeGroup[]> {
  const { data, error } = await db
    .from("restaurants")
    .select(RESTAURANT_COLUMNS)
    .in("status", ["published", "pending"])
    .limit(2000);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Restaurant[];
  return groupDuplicates(rows).map((group) => {
    const sorted = [...group].sort((a, b) => completeness(b) - completeness(a));
    const [primary, ...duplicates] = sorted;
    return { primary: primary!, duplicates, reason: describe(group) };
  });
}

/**
 * Merges duplicates into `primaryId`. Related rows are repointed first so no
 * rating or review is lost, then the duplicates are marked merged.
 */
export async function mergeRestaurants(
  db: Client,
  primaryId: string,
  duplicateIds: string[],
): Promise<{ merged: number }> {
  const ids = duplicateIds.filter((id) => id && id !== primaryId);
  if (ids.length === 0) return { merged: 0 };

  const { data: primaryRows, error: primaryError } = await db
    .from("restaurants")
    .select(RESTAURANT_COLUMNS)
    .eq("id", primaryId)
    .maybeSingle();
  if (primaryError) throw new Error(primaryError.message);
  if (!primaryRows) throw new Error("The listing to keep no longer exists.");
  const primary = primaryRows as unknown as Restaurant;

  const { data: dupeRows } = await db
    .from("restaurants")
    .select(RESTAURANT_COLUMNS)
    .in("id", ids);
  const dupes = (dupeRows ?? []) as unknown as Restaurant[];

  // Fill gaps on the surviving listing from the rows being retired.
  const patch: Record<string, unknown> = {};
  const scalar = [
    "description",
    "address",
    "city",
    "region",
    "phone",
    "website_url",
    "menu_url",
    "hours_text",
    "reservation_url",
    "latitude",
    "longitude",
    "price_level",
  ] as const;
  for (const key of scalar) {
    if ((primary as any)[key] == null || (primary as any)[key] === "") {
      const found = dupes.map((d) => (d as any)[key]).find((v) => v != null && v !== "");
      if (found != null) patch[key] = found;
    }
  }
  const lists = ["cuisines", "restaurant_types", "dish_tags", "features", "dietary", "photos"] as const;
  for (const key of lists) {
    const merged = new Set<string>([...((primary as any)[key] ?? [])]);
    for (const d of dupes) for (const v of (d as any)[key] ?? []) merged.add(v);
    patch[key] = [...merged];
  }
  for (const flag of ["has_delivery", "has_pickup", "has_dine_in", "has_reservations", "has_catering", "verified"] as const) {
    if (dupes.some((d) => (d as any)[flag])) patch[flag] = true;
  }
  if (!primary.hours || Object.keys(primary.hours).length === 0) {
    const hours = dupes.find((d) => d.hours && Object.keys(d.hours).length > 0)?.hours;
    if (hours) patch["hours"] = hours;
  }
  const links = new Map<string, unknown>();
  for (const l of primary.order_links ?? []) links.set(`${(l as any).provider}`, l);
  for (const d of dupes) for (const l of d.order_links ?? []) links.set(`${(l as any).provider}`, l);
  patch["order_links"] = [...links.values()];

  const { error: updateError } = await db.from("restaurants").update(patch).eq("id", primaryId);
  if (updateError) throw new Error(updateError.message);

  // Repoint children. Ratings are keyed by (restaurant_id, source), so any that
  // would collide with an existing source on the primary are dropped instead.
  const { data: kept } = await db
    .from("restaurant_ratings")
    .select("source")
    .eq("restaurant_id", primaryId);
  const keptSources = new Set((kept ?? []).map((r: { source: string }) => r.source));
  const { data: incoming } = await db
    .from("restaurant_ratings")
    .select("restaurant_id, source")
    .in("restaurant_id", ids);
  for (const row of (incoming ?? []) as { restaurant_id: string; source: string }[]) {
    const table = db.from("restaurant_ratings");
    if (keptSources.has(row.source)) {
      await table.delete().eq("restaurant_id", row.restaurant_id).eq("source", row.source);
    } else {
      keptSources.add(row.source);
      await db
        .from("restaurant_ratings")
        .update({ restaurant_id: primaryId })
        .eq("restaurant_id", row.restaurant_id)
        .eq("source", row.source);
    }
  }

  for (const table of ["restaurant_reviews", "restaurant_deals", "restaurant_claims", "food_collection_items"]) {
    await db.from(table).update({ restaurant_id: primaryId }).in("restaurant_id", ids);
  }

  const { error: retireError } = await db
    .from("restaurants")
    .update({ status: "merged", dedupe_key: `merged:${primaryId}` })
    .in("id", ids);
  if (retireError) throw new Error(retireError.message);

  return { merged: ids.length };
}
