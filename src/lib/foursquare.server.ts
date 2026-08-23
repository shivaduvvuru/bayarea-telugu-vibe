/**
 * Optional Foursquare Places enrichment.
 *
 * The directory works fully without it: OSM supplies the listings and
 * TimesBayArea readers supply the ratings. Foursquare is only called for
 * individual restaurants a reader or editor actually opens, and everything it
 * returns is cached on the row so we never pay for the same lookup twice.
 * Every call passes the monthly cost limit in `external_api_budget` first.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { assertBudget, recordCalls } from "@/lib/api-budget.server";

type Db = SupabaseClient<Database>;

const PLACES_SEARCH = "https://places-api.foursquare.com/places/search";

export function foursquareConfigured(): boolean {
  return (process.env["FOURSQUARE_API_KEY"] ?? "").trim().length > 10;
}

type FsqPlace = {
  fsq_place_id?: string;
  fsq_id?: string;
  name?: string;
  tel?: string;
  website?: string;
  price?: number;
  rating?: number;
  description?: string;
  categories?: { name?: string }[];
  location?: { formatted_address?: string; postcode?: string; locality?: string };
  latitude?: number;
  longitude?: number;
};

async function searchPlace(row: {
  name: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}): Promise<FsqPlace | null> {
  const key = (process.env["FOURSQUARE_API_KEY"] ?? "").trim();
  const params = new URLSearchParams({ query: row.name, limit: "1" });
  if (row.latitude != null && row.longitude != null) {
    params.set("ll", `${row.latitude},${row.longitude}`);
    params.set("radius", "1200");
  } else {
    params.set("near", `${row.city ?? "San Jose"}, CA`);
  }
  const res = await fetch(`${PLACES_SEARCH}?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "X-Places-Api-Version": "2025-06-17",
    },
  });
  if (!res.ok) throw new Error(`Foursquare lookup failed (${res.status})`);
  const body = (await res.json()) as { results?: FsqPlace[] };
  return body.results?.[0] ?? null;
}

export type EnrichResult = {
  ok: boolean;
  restaurant: string;
  cached: boolean;
  fields: string[];
  message?: string;
};

/**
 * Enriches one restaurant from Foursquare when the row still has gaps. Returns
 * `cached: true` without spending a call when the row is already enriched.
 */
export async function enrichRestaurantFromFoursquare(
  db: Db,
  slug: string,
  options: { force?: boolean } = {},
): Promise<EnrichResult> {
  if (!foursquareConfigured()) {
    throw new Error("Foursquare is not connected — add the FOURSQUARE_API_KEY secret first.");
  }
  const { data, error } = await db
    .from("restaurants")
    .select(
      "id, slug, name, city, latitude, longitude, phone, website_url, description, price_level, foursquare_id, zip",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) throw error ?? new Error("Restaurant not found");
  const row = data as unknown as {
    id: string;
    slug: string;
    name: string;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    phone: string | null;
    website_url: string | null;
    description: string | null;
    price_level: number | null;
    foursquare_id: string | null;
    zip: string | null;
  };

  if (row.foursquare_id && options.force !== true) {
    return { ok: true, restaurant: row.name, cached: true, fields: [] };
  }

  await assertBudget(db, "foursquare", 1);
  const place = await searchPlace(row);
  await recordCalls(db, "foursquare", 1);
  if (!place) {
    return { ok: false, restaurant: row.name, cached: false, fields: [], message: "No match" };
  }

  const patch: Record<string, unknown> = {
    foursquare_id: place.fsq_place_id ?? place.fsq_id ?? null,
    last_refreshed_at: new Date().toISOString(),
  };
  const fields: string[] = [];
  if (!row.phone && place.tel) {
    patch["phone"] = place.tel;
    fields.push("phone");
  }
  if (!row.website_url && place.website) {
    patch["website_url"] = place.website;
    fields.push("website");
  }
  if (!row.description && (place.description || place.categories?.[0]?.name)) {
    patch["description"] = place.description ?? `${place.categories?.[0]?.name} in ${row.city}.`;
    fields.push("description");
  }
  if (row.price_level == null && typeof place.price === "number") {
    patch["price_level"] = Math.min(Math.max(place.price, 1), 4);
    fields.push("price");
  }
  if (!row.zip && place.location?.postcode) {
    patch["zip"] = place.location.postcode;
    fields.push("zip");
  }
  if (row.latitude == null && place.latitude != null) {
    patch["latitude"] = place.latitude;
    patch["longitude"] = place.longitude ?? null;
    fields.push("coordinates");
  }

  const { error: upErr } = await db
    .from("restaurants")
    .update(patch as never)
    .eq("id", row.id);
  if (upErr) throw upErr;

  if (typeof place.rating === "number") {
    await db.from("restaurant_ratings").upsert(
      {
        restaurant_id: row.id,
        // Foursquare rates out of 10; store on our 5-star scale.
        rating: Math.round((place.rating / 2) * 10) / 10,
        source: "foursquare",
        fetched_at: new Date().toISOString(),
      } as never,
      { onConflict: "restaurant_id,source" },
    );
    fields.push("rating");
  }

  return { ok: true, restaurant: row.name, cached: false, fields };
}
