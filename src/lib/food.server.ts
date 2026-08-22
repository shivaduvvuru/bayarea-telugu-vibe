/**
 * Server-side reads and writes for the Food section. Public reads go through
 * the anonymous, RLS-respecting client so nothing here needs privileged keys.
 */

import { publicClient } from "@/lib/cms.server";
import {
  RESTAURANT_COLUMNS,
  groupDuplicates,
  timesBayAreaScore,
  type CommunityReview,
  type FoodCollection,
  type FoodDeal,
  type Restaurant,
  type RestaurantRating,
} from "@/lib/food";

export type RestaurantSummary = Restaurant & {
  ratings: RestaurantRating[];
  community: { average: number | null; count: number };
  tt_score: number | null;
  review_total: number;
  /** How many other listings were folded into this one on read. */
  duplicate_count?: number;
};

/**
 * Automatic duplicate detection at read time: when several listings describe
 * the same restaurant the most complete one is shown and the rest are hidden,
 * so the same place never appears twice while an editor merges them.
 */
function collapseDuplicates(rows: RestaurantSummary[]): RestaurantSummary[] {
  const groups = groupDuplicates(rows);
  if (groups.length === 0) return rows;
  const hidden = new Set<string>();
  const counts = new Map<string, number>();
  for (const group of groups) {
    const sorted = [...group].sort(
      (a, b) =>
        Number(b.verified) - Number(a.verified) ||
        Number(b.sponsored) - Number(a.sponsored) ||
        b.review_total - a.review_total ||
        b.photos.length - a.photos.length,
    );
    const [keep, ...drop] = sorted;
    if (!keep) continue;
    counts.set(keep.id, drop.length);
    for (const d of drop) hidden.add(d.id);
  }
  return rows
    .filter((r) => !hidden.has(r.id))
    .map((r) => (counts.has(r.id) ? { ...r, duplicate_count: counts.get(r.id) } : r));
}


export type RestaurantQuery = {
  q?: string | undefined;
  city?: string | undefined;
  cuisine?: string | undefined;
  dish?: string | undefined;
  type?: string | undefined;
  diet?: string | undefined;
  feature?: string | undefined;
  service?: string | undefined;
  minRating?: number | undefined;
  maxPrice?: number | undefined;
  limit?: number | undefined;
};

function attach(
  rows: Restaurant[],
  ratings: RestaurantRating[],
  reviews: { restaurant_id: string; rating: number }[],
): RestaurantSummary[] {
  const byRestaurant = new Map<string, RestaurantRating[]>();
  for (const r of ratings) {
    const list = byRestaurant.get(r.restaurant_id) ?? [];
    list.push(r);
    byRestaurant.set(r.restaurant_id, list);
  }
  const community = new Map<string, { sum: number; count: number }>();
  for (const r of reviews) {
    const c = community.get(r.restaurant_id) ?? { sum: 0, count: 0 };
    c.sum += r.rating;
    c.count += 1;
    community.set(r.restaurant_id, c);
  }
  return rows.map((row) => {
    const rs = byRestaurant.get(row.id) ?? [];
    const c = community.get(row.id);
    const average = c && c.count > 0 ? Math.round((c.sum / c.count) * 10) / 10 : null;
    const score = timesBayAreaScore({
      ratings: rs,
      communityAverage: average,
      communityCount: c?.count ?? 0,
    });
    return {
      ...row,
      ratings: rs,
      community: { average, count: c?.count ?? 0 },
      tt_score: score.value,
      review_total: score.totalReviews,
    };
  });
}

/** Published restaurants matching the coarse filters; fine filters run in the UI. */
export async function readRestaurants(query: RestaurantQuery): Promise<RestaurantSummary[]> {
  const db = publicClient();
  let q = db
    .from("restaurants")
    .select(RESTAURANT_COLUMNS)
    .eq("status", "published")
    .order("sponsored", { ascending: false })
    .order("verified", { ascending: false })
    .order("name", { ascending: true })
    .limit(query.limit ?? 200);

  if (query.city) q = q.eq("city", query.city);
  if (query.cuisine) q = q.contains("cuisines", [query.cuisine]);
  if (query.type) q = q.contains("restaurant_types", [query.type]);
  if (query.dish) q = q.contains("dish_tags", [query.dish]);
  if (query.diet) q = q.contains("dietary", [query.diet]);
  if (query.feature) q = q.contains("features", [query.feature]);
  if (query.service === "delivery") q = q.eq("has_delivery", true);
  if (query.service === "pickup") q = q.eq("has_pickup", true);
  if (query.service === "dine-in") q = q.eq("has_dine_in", true);
  if (query.service === "reservations") q = q.eq("has_reservations", true);
  if (query.service === "catering") q = q.eq("has_catering", true);
  if (query.maxPrice) q = q.lte("price_level", query.maxPrice);
  if (query.q) {
    const term = query.q.replace(/[%,]/g, " ").trim();
    if (term) {
      q = q.or(
        [
          `name.ilike.%${term}%`,
          `description.ilike.%${term}%`,
          `city.ilike.%${term}%`,
          `cuisines.cs.{${term}}`,
          `dish_tags.cs.{${term}}`,
        ].join(","),
      );
    }
  }

  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as unknown as Restaurant[];
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [ratings, reviews] = await Promise.all([
    db
      .from("restaurant_ratings")
      .select("restaurant_id, source, rating, review_count, external_url, fetched_at")
      .in("restaurant_id", ids),
    db
      .from("restaurant_reviews")
      .select("restaurant_id, rating")
      .eq("status", "published")
      .in("restaurant_id", ids),
  ]);

  const summaries = attach(
    rows,
    (ratings.data ?? []) as unknown as RestaurantRating[],
    (reviews.data ?? []) as unknown as { restaurant_id: string; rating: number }[],
  );
  return query.minRating
    ? summaries.filter((s) => (s.tt_score ?? 0) >= (query.minRating as number))
    : summaries;
}

export type RestaurantDetail = {
  restaurant: RestaurantSummary;
  reviews: CommunityReview[];
  deals: FoodDeal[];
};

export async function readRestaurant(slug: string): Promise<RestaurantDetail | null> {
  const db = publicClient();
  const { data, error } = await db
    .from("restaurants")
    .select(RESTAURANT_COLUMNS)
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as Restaurant;

  const [ratings, reviews, deals] = await Promise.all([
    db
      .from("restaurant_ratings")
      .select("restaurant_id, source, rating, review_count, external_url, fetched_at")
      .eq("restaurant_id", row.id),
    db
      .from("restaurant_reviews")
      .select(
        "id, restaurant_id, author_name, rating, body, dishes, photos, veg_favorite, family_friendly, recommends, created_at",
      )
      .eq("status", "published")
      .eq("restaurant_id", row.id)
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("restaurant_deals")
      .select(
        "id, restaurant_id, title, description, deal_type, code, url, city, cuisine, sponsored, starts_at, ends_at",
      )
      .eq("status", "published")
      .eq("restaurant_id", row.id),
  ]);

  const reviewRows = (reviews.data ?? []) as unknown as CommunityReview[];
  const [summary] = attach(
    [row],
    (ratings.data ?? []) as unknown as RestaurantRating[],
    reviewRows.map((r) => ({ restaurant_id: r.restaurant_id, rating: r.rating })),
  );
  if (!summary) return null;
  return { restaurant: summary, reviews: reviewRows, deals: (deals.data ?? []) as unknown as FoodDeal[] };
}

export async function readDeals(filter: { city?: string | undefined; cuisine?: string | undefined }) {
  const db = publicClient();
  let q = db
    .from("restaurant_deals")
    .select(
      "id, restaurant_id, title, description, deal_type, code, url, city, cuisine, sponsored, starts_at, ends_at",
    )
    .eq("status", "published")
    .order("sponsored", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (filter.city) q = q.eq("city", filter.city);
  if (filter.cuisine) q = q.eq("cuisine", filter.cuisine);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as FoodDeal[];
}

export async function readCollections(): Promise<FoodCollection[]> {
  const { data, error } = await publicClient()
    .from("food_collections")
    .select("id, slug, title, description, city, cuisine")
    .eq("status", "published")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as FoodCollection[];
}

export async function readCollection(slug: string) {
  const db = publicClient();
  const { data: collection, error } = await db
    .from("food_collections")
    .select("id, slug, title, description, city, cuisine")
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!collection) return null;
  const { data: items } = await db
    .from("food_collection_items")
    .select("restaurant_id, position, note")
    .eq("collection_id", (collection as { id: string }).id)
    .order("position", { ascending: true });
  const ids = (items ?? []).map((i) => (i as { restaurant_id: string }).restaurant_id);
  if (ids.length === 0) {
    return { collection: collection as unknown as FoodCollection, restaurants: [] as RestaurantSummary[] };
  }
  const all = await readRestaurants({ limit: 300 });
  const order = new Map(ids.map((id, index) => [id, index]));
  const restaurants = all
    .filter((r) => order.has(r.id))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return { collection: collection as unknown as FoodCollection, restaurants };
}

/* ------------------------------ writes ------------------------------ */

export type ClaimInput = {
  kind: "add" | "claim";
  restaurant_id?: string | null;
  restaurant_name: string;
  city?: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone?: string | null;
  contact_role?: string | null;
  details: Record<string, string>;
};

/**
 * Stores an owner submission as pending. Contact details live in a private
 * table no reader can select from.
 */
export async function saveClaim(input: ClaimInput) {
  const db = publicClient();
  const { data, error } = await db
    .from("restaurant_claims")
    .insert({
      kind: input.kind,
      restaurant_id: input.restaurant_id ?? null,
      restaurant_name: input.restaurant_name,
      city: input.city ?? null,
      payload: input.details,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw error;
  const claimId = (data as { id: string }).id;
  const { error: contactError } = await db.from("restaurant_claim_contacts").insert({
    claim_id: claimId,
    contact_name: input.contact_name,
    contact_email: input.contact_email,
    contact_phone: input.contact_phone ?? null,
    contact_role: input.contact_role ?? null,
  });
  if (contactError) throw contactError;
  return { id: claimId };
}
