/**
 * Client-safe shape and matching rules for the shared local directory.
 *
 * Every category — food, temples, health, trades, schools, civic — lives in one
 * `directory_entities` table with our own internal id as the application key.
 * Provider ids (OSM, Foursquare, Yelp, Google) are stored only as matching
 * hints, so no paid provider is ever required to run the directory.
 */

export interface DirectoryEntity {
  id: string;
  entity_type: string;
  category: string;
  subcategory: string | null;
  extra_categories: string[];
  community_tags: string[];
  service_tags: string[];
  slug: string;
  name: string;
  description: string | null;
  address: string | null;
  city: string | null;
  county: string | null;
  state: string;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  hours: string | null;
  accessibility: string | null;
  image: string | null;
  price_level: number | null;
  deity: string | null;
  events_url: string | null;
  verified_status: boolean;
  featured_status: boolean;
  needs_review: boolean;
  source: string;
  attribution: string | null;
  external_url: string | null;
  tba_rating: number | null;
  tba_review_count: number;
  created_at: string;
  last_verified_at: string | null;
  last_synced_at: string | null;
}

export const ENTITY_COLUMNS =
  "id, entity_type, category, subcategory, extra_categories, community_tags, service_tags, slug, name, description, address, city, county, state, zip, latitude, longitude, phone, email, website, hours, accessibility, image, price_level, deity, events_url, verified_status, featured_status, needs_review, source, attribution, external_url, tba_rating, tba_review_count, created_at, last_verified_at, last_synced_at";

/* ------------------------------ normalising ------------------------------ */

const NOISE = [
  "inc", "llc", "corp", "corporation", "company", "co", "the", "restaurant",
  "cafe", "and", "&", "of", "services", "service", "center", "centre",
];

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !NOISE.includes(w))
    .join(" ")
    .trim();
}

export function normalizePhone(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

export function siteDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function streetKey(address: string | null | undefined): string | null {
  const first = (address ?? "").split(",")[0]?.trim().toLowerCase();
  if (!first) return null;
  const cleaned = first
    .replace(/\b(suite|ste|unit|apt|#)\s*[\w-]+/g, "")
    .replace(/\b(street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct|place|pl|parkway|pkwy)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return cleaned.length >= 3 ? cleaned : null;
}

export interface DupeCandidate {
  name: string;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * Match keys in confidence order. A shared key means the same business arrived
 * from two providers, so we merge rather than create a second record.
 */
export function dupeKeys(e: DupeCandidate): string[] {
  const name = normalizeName(e.name);
  const city = (e.city ?? "").toLowerCase().trim();
  const keys: string[] = [];
  const phone = normalizePhone(e.phone);
  if (phone) keys.push(`phone:${phone}`);
  const domain = siteDomain(e.website);
  if (domain && name) keys.push(`site:${domain}:${name}`);
  const street = streetKey(e.address);
  if (name && street) keys.push(`addr:${name}:${street}`);
  if (name && city) keys.push(`namecity:${name}:${city}`);
  if (name && e.latitude != null && e.longitude != null) {
    // ~150 m grid: the same shop geocoded slightly differently still collides.
    keys.push(`geo:${name}:${e.latitude.toFixed(3)}:${e.longitude.toFixed(3)}`);
  }
  return keys;
}

/** Primary stored dedupe key (first available), used for fast lookups. */
export function primaryDupeKey(e: DupeCandidate): string | null {
  return dupeKeys(e)[0] ?? null;
}

/** Distance in miles between two points. */
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

/** A record is "incomplete" when the basics a reader needs are missing. */
export function isIncomplete(e: Pick<DirectoryEntity, "address" | "phone" | "website" | "hours">): boolean {
  return !e.address || (!e.phone && !e.website);
}
