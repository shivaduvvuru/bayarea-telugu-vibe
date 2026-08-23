/**
 * OpenStreetMap (Overpass API) ingest — the primary, zero-cost source for the
 * Bay Area restaurant directory.
 *
 * We query Overpass (never the public Nominatim service, which forbids bulk POI
 * downloading) for food POIs around each covered city, map them onto our
 * provider-independent `restaurants` shape and upsert. The OSM object id is one
 * dedupe identifier; normalized name + address + coordinates are the others, so
 * a pull enriches existing listings instead of duplicating them.
 *
 * OSM data is ODbL: every imported row carries an attribution string and the
 * directory shows the "© OpenStreetMap contributors" credit.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { CITY_COORDS, FOOD_CITIES, restaurantDupeKeys } from "@/lib/food";

type Db = SupabaseClient<Database>;

export const OSM_ATTRIBUTION = "© OpenStreetMap contributors (ODbL)";

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const AMENITIES = ["restaurant", "cafe", "fast_food", "food_court", "ice_cream"];

/** Search radius per city in metres — wide enough for a whole small city. */
const RADIUS_M = 6500;

export interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/** One Overpass query for a city centre. Returns raw elements. */
export async function fetchCityPois(city: string, radius = RADIUS_M): Promise<OsmElement[]> {
  const point = CITY_COORDS[city];
  if (!point) throw new Error(`No coordinates on file for ${city}`);
  const filter = `[amenity~"^(${AMENITIES.join("|")})$"]`;
  const query =
    `[out:json][timeout:60];\n` +
    `nwr${filter}(around:${radius},${point.lat},${point.lng});\n` +
    `out center tags;`;

  let lastError = "Overpass unavailable";
  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          // Overpass rejects anonymous clients; identify the app politely.
          "User-Agent": "TimesBayArea/1.0 (food directory; https://timesbayarea.com)",
        },
        body: new URLSearchParams({ data: query }).toString(),
      });
      if (res.status === 429 || res.status === 504) {
        lastError = `Overpass is busy (${res.status}) — try again in a minute.`;
        continue;
      }
      if (!res.ok) {
        lastError = `Overpass failed for ${city} (${res.status})`;
        continue;
      }
      const body = (await res.json()) as { elements?: OsmElement[] };
      return body.elements ?? [];
    } catch (e) {
      lastError = e instanceof Error ? e.message : lastError;
    }
  }
  throw new Error(lastError);
}

/* ------------------------------ mapping ------------------------------ */

const CUISINE_LABELS: Record<string, string> = {
  indian: "Indian",
  south_indian: "South Indian",
  north_indian: "North Indian",
  andhra: "Andhra",
  telugu: "Telugu",
  hyderabadi: "Telugu",
  tamil: "Tamil",
  kerala: "Kerala",
  punjabi: "North Indian",
  pakistani: "Pakistani",
  nepalese: "Himalayan",
  himalayan: "Himalayan",
  tibetan: "Himalayan",
  chinese: "Chinese",
  sichuan: "Chinese",
  japanese: "Japanese",
  sushi: "Japanese",
  ramen: "Japanese",
  korean: "Korean",
  thai: "Thai",
  vietnamese: "Vietnamese",
  asian: "Asian",
  mexican: "Mexican",
  taco: "Mexican",
  italian: "Italian",
  pizza: "Pizza",
  mediterranean: "Mediterranean",
  greek: "Greek",
  middle_eastern: "Middle Eastern",
  lebanese: "Middle Eastern",
  afghan: "Afghan",
  persian: "Persian",
  ethiopian: "Ethiopian",
  american: "American",
  burger: "American",
  barbecue: "BBQ",
  seafood: "Seafood",
  steak_house: "Steakhouse",
  vegan: "Vegan",
  vegetarian: "Vegetarian",
  breakfast: "Breakfast",
  coffee_shop: "Cafe",
  cafe: "Cafe",
  sandwich: "Sandwiches",
  bakery: "Bakery",
  dessert: "Desserts",
  ice_cream: "Desserts",
  juice: "Juice & Smoothies",
  chicken: "Chicken",
  friture: "Fast food",
  regional: "Local",
};

const TYPE_BY_AMENITY: Record<string, string> = {
  cafe: "Cafe",
  fast_food: "Fast food",
  food_court: "Food court",
  ice_cream: "Sweets",
};

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function unique(list: (string | null | undefined)[]): string[] {
  return [...new Set(list.filter((v): v is string => !!v && v.trim().length > 0))];
}

function slugify(name: string, city: string | null, osmId: string): string {
  const base = [name, city]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 62);
  return base ? base : `poi-${osmId.replace(/[^a-z0-9]+/gi, "")}`;
}

function cityOf(tags: Record<string, string>, fallback: string): string {
  const raw = tags["addr:city"]?.trim();
  if (!raw) return fallback;
  const match = FOOD_CITIES.find((c) => c.toLowerCase() === raw.toLowerCase());
  return match ?? raw;
}

export interface MappedOsmRestaurant {
  osm_id: string;
  slug: string;
  name: string;
  description: string | null;
  address: string | null;
  city: string;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  cuisines: string[];
  restaurant_types: string[];
  dish_tags: string[];
  features: string[];
  dietary: string[];
  phone: string | null;
  website_url: string | null;
  hours_text: string | null;
  has_delivery: boolean;
  has_pickup: boolean;
  has_dine_in: boolean;
  has_reservations: boolean;
  has_catering: boolean;
}

/** Maps one Overpass element onto our listing shape. Returns null when unusable. */
export function mapOsmElement(el: OsmElement, fallbackCity: string): MappedOsmRestaurant | null {
  const tags = el.tags ?? {};
  const name = (tags["name"] ?? "").trim();
  if (!name) return null;
  const amenity = tags["amenity"] ?? "restaurant";
  if (!AMENITIES.includes(amenity)) return null;

  const osmId = `${el.type[0]}${el.id}`;
  const city = cityOf(tags, fallbackCity);
  const lat = el.lat ?? el.center?.lat ?? null;
  const lon = el.lon ?? el.center?.lon ?? null;

  const street = unique([tags["addr:housenumber"], tags["addr:street"]]).join(" ").trim();
  const address =
    unique([street || null, city, tags["addr:state"] ?? "CA", tags["addr:postcode"]]).join(", ") ||
    null;

  const cuisineTags = (tags["cuisine"] ?? "")
    .split(";")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  const cuisines = unique(cuisineTags.map((c) => CUISINE_LABELS[c] ?? titleCase(c)));

  const features = unique([
    tags["outdoor_seating"] === "yes" ? "Outdoor seating" : null,
    tags["wheelchair"] === "yes" ? "Wheelchair accessible" : null,
    tags["drive_through"] === "yes" ? "Drive-through" : null,
    tags["internet_access"] && tags["internet_access"] !== "no" ? "Wi-Fi" : null,
    tags["air_conditioning"] === "yes" ? "Air conditioned" : null,
  ]);

  const dietary = unique([
    tags["diet:vegan"] === "yes" || tags["diet:vegan"] === "only" ? "Vegan" : null,
    tags["diet:vegetarian"] === "yes" || tags["diet:vegetarian"] === "only" ? "Vegetarian" : null,
    tags["diet:halal"] === "yes" || tags["diet:halal"] === "only" ? "Halal" : null,
    tags["diet:kosher"] === "yes" ? "Kosher" : null,
    tags["diet:gluten_free"] === "yes" ? "Gluten-free" : null,
  ]);

  const website = tags["website"] ?? tags["contact:website"] ?? tags["url"] ?? null;

  return {
    osm_id: osmId,
    slug: slugify(name, city, osmId),
    name,
    description:
      cuisines.length > 0
        ? `${cuisines.join(", ")} ${amenity === "cafe" ? "cafe" : "restaurant"} in ${city}.`
        : null,
    address,
    city,
    zip: tags["addr:postcode"]?.trim() || null,
    latitude: lat,
    longitude: lon,
    cuisines,
    restaurant_types: unique([TYPE_BY_AMENITY[amenity] ?? null]),
    dish_tags: cuisines.slice(0, 4),
    features,
    dietary,
    phone: (tags["phone"] ?? tags["contact:phone"] ?? "").trim() || null,
    website_url: website && /^https?:\/\//i.test(website) ? website : null,
    hours_text: tags["opening_hours"]?.trim() || null,
    has_delivery: tags["delivery"] === "yes",
    has_pickup: tags["takeaway"] === "yes" || tags["takeaway"] === "only",
    has_dine_in: tags["takeaway"] !== "only" && amenity !== "ice_cream",
    has_reservations: tags["reservation"] === "yes" || tags["reservation"] === "required",
    has_catering: tags["catering"] === "yes",
  };
}

/* ------------------------------ ingest ------------------------------ */

export interface OsmIngestReport {
  ok: boolean;
  preview: boolean;
  cities: string[];
  discovered: number;
  added: number;
  updated: number;
  duplicatesSkipped: number;
  missingAddress: number;
  missingCuisine: number;
  errors: string[];
  perCity: { city: string; discovered: number; added: number; updated: number; skipped: number }[];
  sample: { name: string; city: string; cuisines: string[]; address: string | null }[];
}

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
  photos: string[] | null;
  cuisines: string[] | null;
  hours_text: string | null;
  osm_id: string | null;
};

const SELECT_EXISTING =
  "id, slug, name, branch_label, city, address, website_url, latitude, longitude, description, phone, photos, cuisines, hours_text, osm_id";

function indexRows(rows: ExistingRow[]) {
  const byKey = new Map<string, ExistingRow>();
  const byOsm = new Map<string, ExistingRow>();
  for (const row of rows) {
    if (row.osm_id) byOsm.set(row.osm_id, row);
    for (const key of restaurantDupeKeys(row)) if (!byKey.has(key)) byKey.set(key, row);
    byKey.set(`slug:${row.slug}`, row);
  }
  return { byKey, byOsm };
}

/**
 * Pulls food POIs for the given cities from OSM and (unless `preview`) upserts
 * them. `cuisine` narrows the import to one cuisine label; `perCity` caps how
 * many POIs we write per city so a manual run stays inside the request budget.
 */
export async function ingestOsmCities(
  db: Db,
  options: {
    cities?: string[] | undefined;
    cuisine?: string | undefined;
    perCity?: number | undefined;
    preview?: boolean | undefined;
  } = {},
): Promise<OsmIngestReport> {
  const cities = (options.cities?.length ? options.cities : FOOD_CITIES).filter(
    (c) => typeof c === "string" && !!CITY_COORDS[c],
  );
  const perCity = Math.min(Math.max(options.perCity ?? 120, 10), 400);
  const cuisine = options.cuisine?.trim().toLowerCase() || null;
  const preview = options.preview === true;

  const report: OsmIngestReport = {
    ok: true,
    preview,
    cities,
    discovered: 0,
    added: 0,
    updated: 0,
    duplicatesSkipped: 0,
    missingAddress: 0,
    missingCuisine: 0,
    errors: [],
    perCity: [],
    sample: [],
  };
  if (cities.length === 0) {
    report.ok = false;
    report.errors.push("No Bay Area cities with coordinates were selected.");
    return report;
  }

  const { data: existingRows, error: existingError } = await db
    .from("restaurants")
    .select(SELECT_EXISTING)
    .limit(20000);
  if (existingError) throw existingError;
  const { byKey, byOsm } = indexRows((existingRows ?? []) as unknown as ExistingRow[]);
  const seenOsm = new Set<string>();
  const now = new Date().toISOString();

  for (const city of cities) {
    const line = { city, discovered: 0, added: 0, updated: 0, skipped: 0 };
    let elements: OsmElement[] = [];
    try {
      elements = await fetchCityPois(city);
    } catch (e) {
      report.ok = false;
      report.errors.push(e instanceof Error ? e.message : `OSM failed for ${city}`);
      report.perCity.push(line);
      continue;
    }

    let written = 0;
    for (const el of elements) {
      const mapped = mapOsmElement(el, city);
      if (!mapped) continue;
      if (cuisine && !mapped.cuisines.some((c) => c.toLowerCase().includes(cuisine))) continue;
      if (seenOsm.has(mapped.osm_id)) continue;
      seenOsm.add(mapped.osm_id);

      report.discovered += 1;
      line.discovered += 1;
      if (!mapped.address) report.missingAddress += 1;
      if (mapped.cuisines.length === 0) report.missingCuisine += 1;
      if (report.sample.length < 12) {
        report.sample.push({
          name: mapped.name,
          city: mapped.city,
          cuisines: mapped.cuisines,
          address: mapped.address,
        });
      }

      const keys = restaurantDupeKeys({
        id: "new",
        slug: mapped.slug,
        name: mapped.name,
        branch_label: null,
        city: mapped.city,
        address: mapped.address,
        website_url: mapped.website_url,
        latitude: mapped.latitude,
        longitude: mapped.longitude,
      });
      const match =
        byOsm.get(mapped.osm_id) ??
        keys.map((k) => byKey.get(k)).find((r) => !!r) ??
        byKey.get(`slug:${mapped.slug}`);

      if (match) {
        if (preview) {
          report.updated += 1;
          line.updated += 1;
          continue;
        }
        // Enrich the gaps only — editorial and verified fields always win.
        const patch: Record<string, unknown> = {
          osm_id: match.osm_id ?? mapped.osm_id,
          attribution: OSM_ATTRIBUTION,
          last_refreshed_at: now,
        };
        if (!match.address && mapped.address) patch["address"] = mapped.address;
        if (!match.phone && mapped.phone) patch["phone"] = mapped.phone;
        if (!match.website_url && mapped.website_url) patch["website_url"] = mapped.website_url;
        if (!match.description && mapped.description) patch["description"] = mapped.description;
        if (!match.hours_text && mapped.hours_text) patch["hours_text"] = mapped.hours_text;
        if (match.latitude == null && mapped.latitude != null) {
          patch["latitude"] = mapped.latitude;
          patch["longitude"] = mapped.longitude;
        }
        if ((match.cuisines ?? []).length === 0 && mapped.cuisines.length > 0) {
          patch["cuisines"] = mapped.cuisines;
        }
        const { error } = await db
          .from("restaurants")
          .update(patch as never)
          .eq("id", match.id);
        if (error) {
          report.errors.push(`${mapped.name}: ${error.message}`);
          continue;
        }
        if (!match.osm_id) byOsm.set(mapped.osm_id, { ...match, osm_id: mapped.osm_id });
        report.updated += 1;
        line.updated += 1;
        continue;
      }

      if (written >= perCity) {
        report.duplicatesSkipped += 0;
        line.skipped += 1;
        continue;
      }

      if (preview) {
        report.added += 1;
        line.added += 1;
        written += 1;
        continue;
      }

      const insert = {
        slug: mapped.slug,
        name: mapped.name,
        description: mapped.description,
        address: mapped.address,
        city: mapped.city,
        zip: mapped.zip,
        latitude: mapped.latitude,
        longitude: mapped.longitude,
        cuisines: mapped.cuisines,
        restaurant_types: mapped.restaurant_types,
        dish_tags: mapped.dish_tags,
        features: mapped.features,
        dietary: mapped.dietary,
        phone: mapped.phone,
        website_url: mapped.website_url,
        hours_text: mapped.hours_text,
        has_delivery: mapped.has_delivery,
        has_pickup: mapped.has_pickup,
        has_dine_in: mapped.has_dine_in,
        has_reservations: mapped.has_reservations,
        has_catering: mapped.has_catering,
        status: "published",
        source: "osm",
        osm_id: mapped.osm_id,
        attribution: OSM_ATTRIBUTION,
        dedupe_key: `osm:${mapped.osm_id}`,
        last_refreshed_at: now,
      };
      const { data, error } = await db
        .from("restaurants")
        .upsert(insert as never, { onConflict: "slug" })
        .select("id")
        .maybeSingle();
      if (error || !data) {
        report.errors.push(`${mapped.name}: ${error?.message ?? "insert failed"}`);
        continue;
      }
      const row: ExistingRow = {
        id: (data as { id: string }).id,
        slug: mapped.slug,
        name: mapped.name,
        branch_label: null,
        city: mapped.city,
        address: mapped.address,
        website_url: mapped.website_url,
        latitude: mapped.latitude,
        longitude: mapped.longitude,
        description: mapped.description,
        phone: mapped.phone,
        photos: [],
        cuisines: mapped.cuisines,
        hours_text: mapped.hours_text,
        osm_id: mapped.osm_id,
      };
      byOsm.set(mapped.osm_id, row);
      for (const key of restaurantDupeKeys(row)) if (!byKey.has(key)) byKey.set(key, row);
      byKey.set(`slug:${mapped.slug}`, row);
      report.added += 1;
      line.added += 1;
      written += 1;
    }

    report.perCity.push(line);
  }

  return report;
}
