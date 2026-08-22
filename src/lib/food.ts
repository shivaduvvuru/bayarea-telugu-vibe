/**
 * Client-safe types, taxonomy and scoring for the Food section.
 *
 * The taxonomy lives in plain arrays used only for menus and filter chips —
 * the database stores cuisines, types, dish tags and features as free text
 * arrays, so new cuisines can be added without touching this file.
 */

import { CITY_REGIONS } from "@/lib/content";

export type OrderLink = {
  provider: string;
  url: string;
  /** Which service this link opens. Missing means it covers both. */
  mode?: "delivery" | "pickup" | "both" | null;
  /** Provider-published estimate, in minutes. Only shown when supplied. */
  eta_minutes?: number | null;
};


export type Restaurant = {
  id: string;
  slug: string;
  name: string;
  branch_label: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  cuisines: string[];
  restaurant_types: string[];
  dish_tags: string[];
  features: string[];
  dietary: string[];
  phone: string | null;
  website_url: string | null;
  menu_url: string | null;
  hours: Record<string, string> | null;
  hours_text: string | null;
  price_level: number | null;
  has_delivery: boolean;
  has_pickup: boolean;
  has_dine_in: boolean;
  has_reservations: boolean;
  has_catering: boolean;
  order_links: OrderLink[];
  reservation_url: string | null;
  photos: string[];
  sponsored: boolean;
  verified: boolean;
  opened_at: string | null;
  created_at: string;
  last_refreshed_at: string | null;
};

export type RestaurantRating = {
  restaurant_id: string;
  source: string;
  rating: number | null;
  review_count: number | null;
  external_url: string | null;
  fetched_at: string | null;
};

export type CommunityReview = {
  id: string;
  restaurant_id: string;
  author_name: string;
  rating: number;
  body: string | null;
  dishes: string[];
  photos: string[];
  veg_favorite: boolean;
  family_friendly: boolean;
  recommends: boolean;
  created_at: string;
};

export type FoodDeal = {
  id: string;
  restaurant_id: string | null;
  title: string;
  description: string | null;
  deal_type: string;
  code: string | null;
  url: string | null;
  city: string | null;
  cuisine: string | null;
  sponsored: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

export type FoodCollection = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  city: string | null;
  cuisine: string | null;
};

export const RESTAURANT_COLUMNS =
  "id, slug, name, branch_label, description, address, city, region, latitude, longitude, cuisines, restaurant_types, dish_tags, features, dietary, phone, website_url, menu_url, hours, hours_text, price_level, has_delivery, has_pickup, has_dine_in, has_reservations, has_catering, order_links, reservation_url, photos, sponsored, verified, opened_at, created_at, last_refreshed_at";

/* ------------------------------ taxonomy ------------------------------ */

export const CUISINES = [
  "Indian", "Telugu", "Andhra", "Telangana", "South Indian", "North Indian", "Tamil",
  "Kerala", "Punjabi", "Gujarati", "Bengali", "Hyderabadi", "Indo-Chinese", "Pakistani",
  "Afghan", "Nepali", "Tibetan", "Chinese", "Japanese", "Sushi", "Korean", "Thai",
  "Vietnamese", "Mediterranean", "Middle Eastern", "Greek", "Turkish", "Mexican",
  "Italian", "French", "American", "Burgers", "Pizza", "Steakhouse", "Seafood", "BBQ",
  "African", "Ethiopian", "Vegetarian", "Vegan", "Halal", "Kosher", "Organic / Healthy",
  "Street Food", "Desserts", "Ice Cream", "Bakeries", "Cafes", "Coffee Shops",
  "Breakfast", "Brunch", "Bars & Pubs",
] as const;

export const RESTAURANT_TYPES = [
  "Fast Food", "Fast Casual", "Casual Dining", "Fine Dining", "Buffet", "Food Trucks",
  "Street Food / Chaat", "Dosa & Tiffins", "Biryani", "Breakfast", "Brunch", "Bakeries",
  "Cafes", "Coffee Shops", "Desserts", "Ice Cream", "Bars & Pubs", "Family Restaurants",
  "Late Night", "Catering", "Banquet / Party Food", "BBQ",
] as const;

export const DIETARY = ["Vegetarian", "Vegan", "Halal", "Kosher"] as const;

export const FEATURES = [
  "Outdoor Seating", "Family Friendly", "Late Night", "Alcohol", "Parking", "Catering",
  "Open Early", "No Alcohol", "Reservations",
] as const;

/** Quick tiles on the Food home screen. */
export const QUICK_TILES = [
  { label: "Near Me", to: "/food/restaurants", search: { near: 1 } },
  { label: "Indian", to: "/food/restaurants", search: { cuisine: "Indian" } },
  { label: "Biryani", to: "/food/restaurants", search: { dish: "Biryani" } },
  { label: "Dosa", to: "/food/restaurants", search: { dish: "Dosa" } },
  { label: "Pizza", to: "/food/restaurants", search: { cuisine: "Pizza" } },
  { label: "Chinese", to: "/food/restaurants", search: { cuisine: "Chinese" } },
  { label: "Mexican", to: "/food/restaurants", search: { cuisine: "Mexican" } },
  { label: "Vegetarian", to: "/food/restaurants", search: { diet: "Vegetarian" } },
  { label: "Breakfast", to: "/food/restaurants", search: { cuisine: "Breakfast" } },
  { label: "Desserts", to: "/food/restaurants", search: { cuisine: "Desserts" } },
  { label: "Delivery", to: "/food/restaurants", search: { service: "delivery" } },
  { label: "Open Now", to: "/food/restaurants", search: { open: 1 } },
] as const;

const EXTRA_CITIES = [
  "Newark", "Hayward", "Berkeley", "Redwood City", "San Mateo", "Foster City",
  "Sausalito", "Los Gatos", "Campbell", "Walnut Creek",
];

/** Every city we cover, Bay Area regions first. */
export const FOOD_CITIES: string[] = [
  ...new Set([...CITY_REGIONS.flatMap((r) => r.cities.map((c) => c.en)), ...EXTRA_CITIES]),
].sort((a, b) => a.localeCompare(b));

export const SORTS = [
  { value: "recommended", label: "Recommended" },
  { value: "nearest", label: "Nearest" },
  { value: "rating", label: "Highest rated" },
  { value: "reviews", label: "Most reviewed" },
  { value: "tt", label: "TimesBayArea score" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "newest", label: "Newest" },
] as const;

/* ------------------------------ hours ------------------------------ */

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** Bay Area wall-clock minutes and weekday, so open/closed never uses the device clock. */
export function bayNow(now = new Date()): { day: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = get("weekday").slice(0, 3).toLowerCase();
  const hour = Number(get("hour") === "24" ? "0" : get("hour"));
  return { day: DAYS.includes(weekday as (typeof DAYS)[number]) ? weekday : "mon", minutes: hour * 60 + Number(get("minute")) };
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":");
  return Number(h) * 60 + Number(m ?? 0);
}

/** null when we simply do not know the hours. */
export function isOpenNow(hours: Record<string, string> | null | undefined, now = new Date()): boolean | null {
  if (!hours || Object.keys(hours).length === 0) return null;
  const { day, minutes } = bayNow(now);
  const window = hours[day];
  if (!window || window === "closed") return false;
  const [open, close] = window.split("-");
  if (!open || !close) return null;
  const from = toMinutes(open);
  const to = toMinutes(close);
  // A window that ends past midnight is stored as e.g. 18:00-01:30.
  return to > from ? minutes >= from && minutes < to : minutes >= from || minutes < to;
}

export function priceLabel(level: number | null | undefined) {
  return level && level > 0 ? "$".repeat(Math.min(level, 4)) : "";
}

/* ------------------------------ scoring ------------------------------ */

/** How much we trust each source; nothing is treated as interchangeable. */
const SOURCE_WEIGHT: Record<string, number> = {
  google: 1,
  yelp: 0.9,
  opentable: 0.7,
  tripadvisor: 0.6,
  doordash: 0.6,
  ubereats: 0.6,
  grubhub: 0.5,
  facebook: 0.4,
  timesbayarea: 1,
};

const PRIOR = 3.9;
const PRIOR_WEIGHT = 12;

export type ScoreInput = {
  ratings: Pick<RestaurantRating, "source" | "rating" | "review_count" | "fetched_at">[];
  communityAverage?: number | null;
  communityCount?: number;
};

export type Score = {
  value: number | null;
  contributors: { source: string; rating: number; reviews: number }[];
  totalReviews: number;
};

/**
 * TimesBayArea score: a Bayesian blend of the sources we are allowed to show,
 * weighted by source reliability and review volume and damped towards a
 * neutral prior, so five reviews on one platform cannot swing the result.
 */
export function timesBayAreaScore(input: ScoreInput): Score {
  const contributors: Score["contributors"] = [];
  let weighted = PRIOR * PRIOR_WEIGHT;
  let weight = PRIOR_WEIGHT;
  let totalReviews = 0;

  const rows = [...input.ratings];
  if (input.communityAverage != null && (input.communityCount ?? 0) > 0) {
    rows.push({
      source: "timesbayarea",
      rating: input.communityAverage,
      review_count: input.communityCount ?? 0,
      fetched_at: new Date().toISOString(),
    });
  }

  for (const row of rows) {
    if (row.rating == null) continue;
    const reviews = Math.max(row.review_count ?? 0, 1);
    const trust = SOURCE_WEIGHT[row.source.toLowerCase()] ?? 0.5;
    // Freshness: ratings older than a year count for half.
    const age = row.fetched_at ? Date.now() - new Date(row.fetched_at).getTime() : 0;
    const fresh = age > 365 * 864e5 ? 0.5 : 1;
    // Volume is capped so a mega-platform cannot drown the rest.
    const w = trust * fresh * Math.min(reviews, 400);
    weighted += row.rating * w;
    weight += w;
    totalReviews += row.review_count ?? 0;
    contributors.push({ source: row.source, rating: row.rating, reviews: row.review_count ?? 0 });
  }

  if (contributors.length === 0) return { value: null, contributors, totalReviews: 0 };
  return { value: Math.round((weighted / weight) * 10) / 10, contributors, totalReviews };
}

export const SOURCE_LABEL: Record<string, string> = {
  google: "Google",
  yelp: "Yelp",
  opentable: "OpenTable",
  tripadvisor: "TripAdvisor",
  doordash: "DoorDash",
  ubereats: "Uber Eats",
  grubhub: "Grubhub",
  facebook: "Facebook",
  timesbayarea: "TimesBayArea",
};

/* ------------------------------ links ------------------------------ */

function q(r: Pick<Restaurant, "name" | "city">) {
  return encodeURIComponent(`${r.name} ${r.city ?? "Bay Area"}`);
}

/**
 * Ordering choices. Restaurant-supplied links win; otherwise we send the user
 * to the provider's own search page (a permitted deep link) rather than
 * inventing a storefront URL we have not verified.
 */
export function orderChoices(r: Restaurant): OrderLink[] {
  const own = Array.isArray(r.order_links) ? r.order_links.filter((l) => l?.url) : [];
  if (own.length > 0) return own;
  if (!r.has_delivery && !r.has_pickup) return [];
  return [
    { provider: "DoorDash", url: `https://www.doordash.com/search/store/${q(r)}` },
    { provider: "Uber Eats", url: `https://www.ubereats.com/search?q=${q(r)}` },
    { provider: "Grubhub", url: `https://www.grubhub.com/search?queryText=${q(r)}` },
    ...(r.website_url ? [{ provider: "Restaurant direct", url: r.website_url }] : []),
  ];
}

/** Where to read the full reviews when we cannot display a platform's rating. */
export function reviewLinks(r: Restaurant) {
  return [
    { label: "View reviews on Google", url: `https://www.google.com/maps/search/${q(r)}` },
    { label: "View on Yelp", url: `https://www.yelp.com/search?find_desc=${q(r)}` },
    { label: "View on TripAdvisor", url: `https://www.tripadvisor.com/Search?q=${q(r)}` },
  ];
}

export function directionsUrl(r: Restaurant) {
  return r.latitude != null && r.longitude != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${r.latitude},${r.longitude}`
    : `https://www.google.com/maps/dir/?api=1&destination=${q(r)}`;
}

export function reservationUrl(r: Restaurant) {
  return r.reservation_url ?? `https://www.opentable.com/s?term=${q(r)}`;
}

/* ------------------------------ geo ------------------------------ */

export function milesBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)) * 10) / 10;
}

/** Approximate city centres, used when a listing has no coordinates yet. */
export const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  "San Jose": { lat: 37.3382, lng: -121.8863 },
  "Santa Clara": { lat: 37.3541, lng: -121.9552 },
  Sunnyvale: { lat: 37.3688, lng: -122.0363 },
  Milpitas: { lat: 37.4323, lng: -121.8996 },
  Cupertino: { lat: 37.323, lng: -122.0322 },
  Gilroy: { lat: 37.0058, lng: -121.5683 },
  Fremont: { lat: 37.5485, lng: -121.9886 },
  Newark: { lat: 37.5297, lng: -122.0402 },
  "Union City": { lat: 37.5934, lng: -122.0438 },
  Hayward: { lat: 37.6688, lng: -122.0808 },
  Pleasanton: { lat: 37.6624, lng: -121.8747 },
  Dublin: { lat: 37.7022, lng: -121.9358 },
  Livermore: { lat: 37.6819, lng: -121.768 },
  "San Ramon": { lat: 37.7799, lng: -121.978 },
  Oakland: { lat: 37.8044, lng: -122.2712 },
  Berkeley: { lat: 37.8715, lng: -122.273 },
  "Mountain View": { lat: 37.3861, lng: -122.0839 },
  "Palo Alto": { lat: 37.4419, lng: -122.143 },
  "Redwood City": { lat: 37.4852, lng: -122.2364 },
  "San Mateo": { lat: 37.5629, lng: -122.3255 },
  "Foster City": { lat: 37.5585, lng: -122.2711 },
  "San Francisco": { lat: 37.7749, lng: -122.4194 },
  Sausalito: { lat: 37.8591, lng: -122.4853 },
  "Los Gatos": { lat: 37.2358, lng: -121.9624 },
  Campbell: { lat: 37.2872, lng: -121.95 },
  "Walnut Creek": { lat: 37.9101, lng: -122.0652 },
};

export function coordsFor(r: Pick<Restaurant, "latitude" | "longitude" | "city">) {
  if (r.latitude != null && r.longitude != null) return { lat: r.latitude, lng: r.longitude };
  return r.city ? CITY_COORDS[r.city] ?? null : null;
}

/* ------------------------------ maps and drive time ------------------------------ */

/** Google's keyless embed. Coordinates when we have them, name+city otherwise. */
export function mapEmbedUrl(
  target: { lat: number; lng: number } | string,
  zoom = 13,
): string {
  const q = typeof target === "string" ? encodeURIComponent(target) : `${target.lat},${target.lng}`;
  return `https://www.google.com/maps?q=${q}&z=${zoom}&output=embed`;
}

export function restaurantMapUrl(r: Pick<Restaurant, "name" | "city" | "address" | "latitude" | "longitude">) {
  const point = r.latitude != null && r.longitude != null ? { lat: r.latitude, lng: r.longitude } : null;
  return mapEmbedUrl(point ?? `${r.name} ${r.address ?? r.city ?? "Bay Area"}`, 15);
}

/**
 * Approximate driving minutes from straight-line miles: a 1.3x detour factor
 * over local streets at ~27 mph, floored at three minutes. Always labelled as
 * an estimate — we never present it as a routed time.
 */
export function driveMinutes(miles: number | null | undefined): number | null {
  if (miles == null || !Number.isFinite(miles)) return null;
  return Math.max(3, Math.round((miles * 1.3) / 27 * 60));
}

export function driveTimeLabel(miles: number | null | undefined): string | null {
  const mins = driveMinutes(miles);
  return mins == null ? null : mins >= 60 ? `~${Math.round(mins / 6) / 10} hr drive` : `~${mins} min drive`;
}

/* ------------------------------ ordering actions ------------------------------ */

export type OrderActions = {
  delivery: OrderLink[];
  pickup: OrderLink[];
  /** Best provider-published delivery estimate, when any provider supplied one. */
  deliveryEta: number | null;
};

/** Splits the ordering links into Delivery and Pickup actions. */
export function orderActions(r: Restaurant): OrderActions {
  const links = orderChoices(r);
  const forMode = (mode: "delivery" | "pickup") =>
    links.filter((l) => !l.mode || l.mode === "both" || l.mode === mode);
  const etas = links
    .filter((l) => !l.mode || l.mode === "both" || l.mode === "delivery")
    .map((l) => l.eta_minutes)
    .filter((n): n is number => typeof n === "number" && n > 0);
  return {
    delivery: r.has_delivery ? forMode("delivery") : [],
    pickup: r.has_pickup ? forMode("pickup") : [],
    deliveryEta: etas.length > 0 ? Math.min(...etas) : null,
  };
}

/* ------------------------------ duplicate detection ------------------------------ */

const NOISE =
  /\b(restaurant|restaurants|cuisine|kitchen|kitchens|indian|the|and|cafe|bar|grill|house|family|authentic|original|bay ?area)\b/g;

/** Name reduced to its identifying core: no branch words, punctuation or noise. */
export function normalizeRestaurantName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(NOISE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Registrable-ish host for a website: no scheme, no www, no path. */
export function siteDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname.toLowerCase();
    return host.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

export type DupeCandidate = Pick<
  Restaurant,
  "id" | "slug" | "name" | "branch_label" | "city" | "address" | "website_url" | "latitude" | "longitude"
>;

/**
 * Identity keys for one listing. Two listings are duplicates when any key
 * matches: same name in the same city, same website domain plus city, or the
 * same street address. Different branches of one brand stay separate because
 * the city (and address) differ.
 */
export function restaurantDupeKeys(r: DupeCandidate): string[] {
  const name = normalizeRestaurantName(r.name);
  const city = (r.city ?? "").toLowerCase().trim();
  const domain = siteDomain(r.website_url);
  const street = (r.address ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(suite|ste|unit|apt|#)\b.*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  const keys: string[] = [];
  if (name && city) keys.push(`nc:${name}|${city}`);
  if (domain && city) keys.push(`dc:${domain}|${city}`);
  if (street.length > 8) keys.push(`a:${street}`);
  if (name && r.latitude != null && r.longitude != null) {
    // ~0.005 degrees is roughly a third of a mile: the same building.
    keys.push(`ng:${name}|${r.latitude.toFixed(2)}|${r.longitude.toFixed(2)}`);
  }
  return keys;
}

/** Groups listings that describe the same restaurant. Singletons are dropped. */
export function groupDuplicates<T extends DupeCandidate>(rows: T[]): T[][] {
  const owner = new Map<string, number>();
  const groups: T[][] = [];
  for (const row of rows) {
    const keys = restaurantDupeKeys(row);
    const hit = keys.map((k) => owner.get(k)).find((i) => i != null);
    const index = hit ?? groups.push([]) - 1;
    groups[index]!.push(row);
    for (const k of keys) owner.set(k, index);
  }
  return groups.filter((g) => g.length > 1);
}
