/**
 * Yelp Fusion ingest for the restaurant directory.
 *
 * For each Bay Area city we page through Yelp's restaurant listings, map every
 * business onto our `restaurants` shape and upsert it. Existing listings are
 * matched with the same duplicate keys the directory already uses, so a Yelp
 * pull enriches a listing (address, phone, coordinates, services) instead of
 * creating a second copy. Yelp's star rating and review count are stored in
 * `restaurant_ratings` with a link back to the Yelp page for attribution.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { CITY_COORDS, FOOD_CITIES, restaurantDupeKeys } from "@/lib/food";

type Db = SupabaseClient<Database>;

export type YelpBusiness = {
  id: string;
  alias?: string;
  name: string;
  image_url?: string;
  url?: string;
  is_closed?: boolean;
  review_count?: number;
  rating?: number;
  price?: string;
  display_phone?: string;
  phone?: string;
  categories?: { alias: string; title: string }[];
  coordinates?: { latitude?: number; longitude?: number };
  transactions?: string[];
  location?: {
    address1?: string;
    address2?: string;
    address3?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    display_address?: string[];
  };
};

const YELP_SEARCH = "https://api.yelp.com/v3/businesses/search";
/** Yelp caps offset at 1000 and page size at 50. */
const PAGE = 50;

function apiKey(): string {
  const key = process.env["YELP_API_KEY"];
  if (!key) throw new Error("Yelp is not connected yet — add the YELP_API_KEY secret.");
  return key;
}

async function searchCity(city: string, offset: number): Promise<YelpBusiness[]> {
  const params = new URLSearchParams({
    location: `${city}, CA`,
    categories: "restaurants",
    limit: String(PAGE),
    offset: String(offset),
    sort_by: "review_count",
  });
  const res = await fetch(`${YELP_SEARCH}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${apiKey()}`, Accept: "application/json" },
  });
  if (res.status === 429) throw new Error("Yelp rate limit reached — try again later.");
  if (!res.ok) throw new Error(`Yelp search failed for ${city} (${res.status})`);
  const body = (await res.json()) as { businesses?: YelpBusiness[] };
  return body.businesses ?? [];
}

/* ------------------------------ mapping ------------------------------ */

const CUISINE_BY_CATEGORY: Record<string, string> = {
  indpak: "Indian",
  hyderabadi: "Telugu",
  andhra: "Andhra",
  southindian: "South Indian",
  northindian: "North Indian",
  chettinad: "Tamil",
  pakistani: "Pakistani",
  himalayan: "Himalayan",
  chinese: "Chinese",
  szechuan: "Chinese",
  hotpot: "Chinese",
  japanese: "Japanese",
  sushi: "Japanese",
  ramen: "Japanese",
  korean: "Korean",
  thai: "Thai",
  vietnamese: "Vietnamese",
  mexican: "Mexican",
  tacos: "Mexican",
  italian: "Italian",
  pizza: "Pizza",
  mediterranean: "Mediterranean",
  mideastern: "Middle Eastern",
  afghani: "Afghan",
  persian: "Persian",
  ethiopian: "Ethiopian",
  burgers: "American",
  newamerican: "American",
  tradamerican: "American",
  bbq: "BBQ",
  seafood: "Seafood",
  steak: "Steakhouse",
  vegan: "Vegan",
  vegetarian: "Vegetarian",
  breakfast_brunch: "Breakfast",
  cafes: "Cafe",
  coffee: "Cafe",
  desserts: "Desserts",
  icecream: "Desserts",
  bakeries: "Bakery",
  juicebars: "Juice & Smoothies",
  foodtrucks: "Food Truck",
  buffets: "Buffet",
  halal: "Halal",
};

const TYPE_BY_CATEGORY: Record<string, string> = {
  foodtrucks: "Food truck",
  cafes: "Cafe",
  coffee: "Cafe",
  bakeries: "Bakery",
  buffets: "Buffet",
  desserts: "Sweets",
  icecream: "Sweets",
  catering: "Catering",
  grocery: "Grocery",
  bars: "Bar",
};

const DIET_BY_CATEGORY: Record<string, string> = {
  vegan: "Vegan",
  vegetarian: "Vegetarian",
  gluten_free: "Gluten-free",
  halal: "Halal",
  kosher: "Kosher",
};

function unique(list: (string | null | undefined)[]): string[] {
  return [...new Set(list.filter((v): v is string => !!v))];
}

function slugify(name: string, city: string | null): string {
  return [name, city]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
}

function cityOf(b: YelpBusiness, fallback: string): string {
  const raw = b.location?.city?.trim();
  if (!raw) return fallback;
  const match = FOOD_CITIES.find((c) => c.toLowerCase() === raw.toLowerCase());
  return match ?? raw;
}

export type MappedRestaurant = {
  slug: string;
  name: string;
  description: string | null;
  address: string | null;
  city: string;
  latitude: number | null;
  longitude: number | null;
  cuisines: string[];
  restaurant_types: string[];
  dish_tags: string[];
  features: string[];
  dietary: string[];
  phone: string | null;
  photos: string[];
  price_level: number | null;
  has_delivery: boolean;
  has_pickup: boolean;
  has_dine_in: boolean;
  has_reservations: boolean;
  has_catering: boolean;
  status: string;
  source: string;
  yelp_id: string;
  yelp_url: string | null;
  rating: number | null;
  review_count: number | null;
};

/** Maps one Yelp business onto our listing shape. Returns null when unusable. */
export function mapBusiness(b: YelpBusiness, fallbackCity: string): MappedRestaurant | null {
  if (!b?.id || !b.name || b.is_closed) return null;
  const cats = (b.categories ?? []).map((c) => c.alias);
  const titles = (b.categories ?? []).map((c) => c.title);
  const city = cityOf(b, fallbackCity);
  const address =
    b.location?.display_address && b.location.display_address.length > 0
      ? b.location.display_address.join(", ")
      : unique([b.location?.address1, b.location?.address2, city, b.location?.state]).join(", ") ||
        null;

  const cuisines = unique(cats.map((a) => CUISINE_BY_CATEGORY[a]));
  const transactions = b.transactions ?? [];

  return {
    slug: slugify(b.name, city),
    name: b.name.trim(),
    description: titles.length > 0 ? `${titles.join(", ")} in ${city}.` : null,
    address,
    city,
    latitude: b.coordinates?.latitude ?? null,
    longitude: b.coordinates?.longitude ?? null,
    cuisines: cuisines.length > 0 ? cuisines : unique(titles.slice(0, 2)),
    restaurant_types: unique(cats.map((a) => TYPE_BY_CATEGORY[a])),
    dish_tags: unique(titles.slice(0, 4)),
    features: [],
    dietary: unique(cats.map((a) => DIET_BY_CATEGORY[a])),
    phone: b.display_phone?.trim() || b.phone?.trim() || null,
    photos: unique([b.image_url]),
    price_level: b.price ? b.price.replace(/[^$]/g, "").length || null : null,
    has_delivery: transactions.includes("delivery"),
    has_pickup: transactions.includes("pickup"),
    has_dine_in: true,
    has_reservations: transactions.includes("restaurant_reservation"),
    has_catering: cats.includes("catering"),
    status: "published",
    source: "yelp",
    yelp_id: b.id,
    yelp_url: b.url ?? (b.alias ? `https://www.yelp.com/biz/${b.alias}` : null),
    rating: typeof b.rating === "number" ? b.rating : null,
    review_count: typeof b.review_count === "number" ? b.review_count : null,
  };
}

/* ------------------------------ persistence ------------------------------ */

type ExistingRow = {
  id: string;
  slug: string;
  name: string;
  branch_label: string | null;
  city: string | null;
  address: string | null;
  website_url: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  phone: string | null;
  photos: string[];
  cuisines: string[];
};

async function loadExisting(db: Db, cities: string[]): Promise<ExistingRow[]> {
  const { data, error } = await db
    .from("restaurants")
    .select(
      "id, slug, name, branch_label, city, address, website_url, latitude, longitude, description, phone, photos, cuisines",
    )
    .in("city", cities);
  if (error) throw error;
  return (data ?? []) as unknown as ExistingRow[];
}

function indexByKeys(rows: ExistingRow[]): Map<string, ExistingRow> {
  const map = new Map<string, ExistingRow>();
  for (const row of rows) {
    for (const key of restaurantDupeKeys(row)) if (!map.has(key)) map.set(key, row);
    map.set(`slug:${row.slug}`, row);
  }
  return map;
}

export type YelpIngestResult = {
  ok: boolean;
  cities: number;
  fetched: number;
  created: number;
  updated: number;
  ratings: number;
  skipped: number;
  errors: string[];
};

/**
 * Pulls restaurants for the given cities (all covered Bay Area cities by
 * default) and upserts listings plus Yelp ratings. `perCity` caps how deep we
 * page so a manual run stays inside the request budget.
 */
export async function ingestYelpCities(
  db: Db,
  options: { cities?: string[] | undefined; perCity?: number | undefined } = {},
): Promise<YelpIngestResult> {
  const cities = (options.cities?.length ? options.cities : FOOD_CITIES).filter((c) =>
    typeof c === "string" && c.trim().length > 0,
  );
  const perCity = Math.min(Math.max(options.perCity ?? 100, PAGE), 240);
  const result: YelpIngestResult = {
    ok: true,
    cities: cities.length,
    fetched: 0,
    created: 0,
    updated: 0,
    ratings: 0,
    skipped: 0,
    errors: [],
  };

  const existing = await loadExisting(db, cities);
  const index = indexByKeys(existing);
  const seenYelp = new Set<string>();

  for (const city of cities) {
    let businesses: YelpBusiness[] = [];
    try {
      for (let offset = 0; offset < perCity; offset += PAGE) {
        const page = await searchCity(city, offset);
        businesses = businesses.concat(page);
        if (page.length < PAGE) break;
      }
    } catch (e) {
      result.ok = false;
      result.errors.push(e instanceof Error ? e.message : `Yelp failed for ${city}`);
      continue;
    }

    for (const raw of businesses) {
      const mapped = mapBusiness(raw, city);
      if (!mapped) {
        result.skipped += 1;
        continue;
      }
      if (seenYelp.has(mapped.yelp_id)) continue;
      seenYelp.add(mapped.yelp_id);
      result.fetched += 1;

      const keys = restaurantDupeKeys({
        id: "new",
        slug: mapped.slug,
        name: mapped.name,
        branch_label: null,
        city: mapped.city,
        address: mapped.address,
        website_url: null,
        latitude: mapped.latitude,
        longitude: mapped.longitude,
      });
      const match =
        keys.map((k) => index.get(k)).find((r) => !!r) ?? index.get(`slug:${mapped.slug}`);

      let id = match?.id ?? null;
      if (match) {
        // Enrich only the gaps: editorial copy and verified fields win.
        const patch: Record<string, unknown> = {
          last_refreshed_at: new Date().toISOString(),
        };
        if (!match.address && mapped.address) patch["address"] = mapped.address;
        if (!match.phone && mapped.phone) patch["phone"] = mapped.phone;
        if (!match.description && mapped.description) patch["description"] = mapped.description;
        if (match.latitude == null && mapped.latitude != null) {
          patch["latitude"] = mapped.latitude;
          patch["longitude"] = mapped.longitude;
        }
        if ((match.photos ?? []).length === 0 && mapped.photos.length > 0) {
          patch["photos"] = mapped.photos;
        }
        if ((match.cuisines ?? []).length === 0 && mapped.cuisines.length > 0) {
          patch["cuisines"] = mapped.cuisines;
        }
        const { error } = await db
          .from("restaurants")
          .update(patch as never)
          .eq("id", match.id);
        if (error) {
          result.errors.push(`${mapped.name}: ${error.message}`);
          continue;
        }
        result.updated += 1;
      } else {
        const insert = {
          slug: mapped.slug,
          name: mapped.name,
          description: mapped.description,
          address: mapped.address,
          city: mapped.city,
          latitude: mapped.latitude,
          longitude: mapped.longitude,
          cuisines: mapped.cuisines,
          restaurant_types: mapped.restaurant_types,
          dish_tags: mapped.dish_tags,
          features: mapped.features,
          dietary: mapped.dietary,
          phone: mapped.phone,
          photos: mapped.photos,
          price_level: mapped.price_level,
          has_delivery: mapped.has_delivery,
          has_pickup: mapped.has_pickup,
          has_dine_in: mapped.has_dine_in,
          has_reservations: mapped.has_reservations,
          has_catering: mapped.has_catering,
          status: "published",
          source: "yelp",
          dedupe_key: `yelp:${mapped.yelp_id}`,
          last_refreshed_at: new Date().toISOString(),
        };
        const { data, error } = await db
          .from("restaurants")
          .upsert(insert as never, { onConflict: "slug" })
          .select("id")
          .maybeSingle();
        if (error || !data) {
          result.errors.push(`${mapped.name}: ${error?.message ?? "insert failed"}`);
          continue;
        }
        id = (data as { id: string }).id;
        result.created += 1;
        const row: ExistingRow = {
          id,
          slug: mapped.slug,
          name: mapped.name,
          branch_label: null,
          city: mapped.city,
          address: mapped.address,
          website_url: null,
          latitude: mapped.latitude,
          longitude: mapped.longitude,
          description: mapped.description,
          phone: mapped.phone,
          photos: mapped.photos,
          cuisines: mapped.cuisines,
        };
        for (const key of restaurantDupeKeys(row)) if (!index.has(key)) index.set(key, row);
        index.set(`slug:${mapped.slug}`, row);
      }

      if (id && mapped.rating != null) {
        const { error } = await db.from("restaurant_ratings").upsert(
          {
            restaurant_id: id,
            source: "yelp",
            rating: mapped.rating,
            review_count: mapped.review_count,
            external_url: mapped.yelp_url,
            fetched_at: new Date().toISOString(),
          } as never,
          { onConflict: "restaurant_id,source" },
        );
        if (!error) result.ratings += 1;
      }
    }
  }

  return result;
}

/** Cities we can pull, cheapest first for a manual run. */
export const YELP_CITIES = FOOD_CITIES.filter((c) => c in CITY_COORDS).concat(
  FOOD_CITIES.filter((c) => !(c in CITY_COORDS)),
);
