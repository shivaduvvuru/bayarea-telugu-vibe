/**
 * OpenStreetMap (Overpass) ingest for the whole local directory.
 *
 * The same architecture proven on restaurants, generalised: the taxonomy in
 * `directory-taxonomy.ts` supplies Overpass tag selectors per subcategory, this
 * module runs one query per (city, subcategory) pair, maps the result onto the
 * provider-independent `directory_entities` shape, deduplicates against what we
 * already hold and either enriches the existing row or inserts a new one.
 *
 * Cost: zero. Overpass is free and OSM data is ODbL, so every imported row
 * carries the required attribution. Nominatim is never used for bulk POIs.
 * Paid providers stay optional and are gated by `api-budget.server.ts`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  DIRECTORY_TAXONOMY,
  communityTagsFor,
  extraCategoriesFor,
  osmSubcategories,
  type DirectoryCategory,
  type DirectorySubcategory,
} from "@/lib/directory-taxonomy";
import { countyOf, resolveGeography, type DirectoryCity } from "@/lib/directory-geo";
import { dupeKeys, isIncomplete, primaryDupeKey } from "@/lib/directory";

type Db = SupabaseClient<Database>;

export const OSM_ATTRIBUTION = "© OpenStreetMap contributors (ODbL)";

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const DEFAULT_RADIUS = 6500;

interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/** One Overpass call for a city + subcategory selector set. */
async function fetchPois(city: DirectoryCity, selectors: string[]): Promise<OsmElement[]> {
  const radius = city.radius ?? DEFAULT_RADIUS;
  const body = selectors
    .map((sel) => `nwr${sel}(around:${radius},${city.lat},${city.lng});`)
    .join("\n");
  const query = `[out:json][timeout:50];\n(\n${body}\n);\nout center tags;`;

  let lastError = "Overpass unavailable";
  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": "TimesBayArea/1.0 (local directory; https://timesbayarea.com)",
        },
        body: new URLSearchParams({ data: query }).toString(),
      });
      if (res.status === 429 || res.status === 504) {
        lastError = `Overpass is busy (${res.status}) — try again shortly.`;
        continue;
      }
      if (!res.ok) {
        lastError = `Overpass failed for ${city.name} (${res.status})`;
        continue;
      }
      const json = (await res.json()) as { elements?: OsmElement[] };
      return json.elements ?? [];
    } catch (e) {
      lastError = e instanceof Error ? e.message : lastError;
    }
  }
  throw new Error(lastError);
}

/* ------------------------------ mapping ------------------------------ */

function unique(list: (string | null | undefined)[]): string[] {
  return [...new Set(list.filter((v): v is string => !!v && v.trim().length > 0))];
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function slugify(name: string, city: string, osmId: string): string {
  const base = `${name} ${city}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 56);
  return `${base || "listing"}-${osmId.toLowerCase()}`;
}

const DEITIES = [
  "venkateswara", "balaji", "shiva", "vishnu", "ganesha", "hanuman", "durga",
  "lakshmi", "saraswati", "murugan", "krishna", "rama", "ayyappa", "sai baba",
];

export interface MappedEntity {
  osm_id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  subcategory: string;
  extra_categories: string[];
  community_tags: string[];
  service_tags: string[];
  entity_type: string;
  address: string | null;
  city: string;
  county: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  hours: string | null;
  accessibility: string | null;
  deity: string | null;
  events_url: string | null;
}

export function mapElement(
  el: OsmElement,
  category: DirectoryCategory,
  sub: DirectorySubcategory,
  cityName: string,
): MappedEntity | null {
  const tags = el.tags ?? {};
  const name = (tags["name"] ?? "").trim();
  if (!name) return null;

  const osmId = `${el.type[0]}${el.id}`;
  const city = (tags["addr:city"] ?? "").trim() || cityName.split(" — ")[0]!;
  const street = tags["addr:street"]
    ? unique([tags["addr:housenumber"], tags["addr:street"]]).join(" ").trim()
    : "";
  const address =
    unique([street || null, city, tags["addr:state"] ?? "CA", tags["addr:postcode"]]).join(", ") ||
    null;

  const website = tags["website"] ?? tags["contact:website"] ?? tags["url"] ?? null;
  const descriptionParts = unique([
    tags["description"] ?? null,
    tags["cuisine"] ? `${titleCase(tags["cuisine"].split(";")[0]!)} · ${sub.label}` : null,
  ]);
  const text = `${name} ${descriptionParts.join(" ")} ${tags["cuisine"] ?? ""} ${website ?? ""} ${tags["operator"] ?? ""}`;

  const serviceTags = unique([
    tags["takeaway"] && tags["takeaway"] !== "no" ? "Takeaway" : null,
    tags["delivery"] === "yes" ? "Delivery" : null,
    tags["outdoor_seating"] === "yes" ? "Outdoor seating" : null,
    tags["internet_access"] && tags["internet_access"] !== "no" ? "Wi-Fi" : null,
    tags["drive_through"] === "yes" ? "Drive-through" : null,
    tags["appointment"] === "yes" ? "By appointment" : null,
    tags["diet:vegetarian"] && tags["diet:vegetarian"] !== "no" ? "Vegetarian options" : null,
    tags["diet:vegan"] && tags["diet:vegan"] !== "no" ? "Vegan options" : null,
    tags["diet:halal"] && tags["diet:halal"] !== "no" ? "Halal" : null,
  ]);

  const deity =
    category.key === "religious"
      ? DEITIES.find((d) => name.toLowerCase().includes(d))?.replace(/\b\w/g, (c) => c.toUpperCase()) ??
        (tags["deity"] ? titleCase(tags["deity"]) : null)
      : null;

  return {
    osm_id: osmId,
    slug: slugify(name, city, osmId),
    name,
    description: descriptionParts[0] ?? null,
    category: category.key,
    subcategory: sub.key,
    extra_categories: extraCategoriesFor(category, sub, text),
    community_tags: communityTagsFor(text),
    service_tags: serviceTags,
    entity_type:
      category.key === "religious"
        ? "place_of_worship"
        : category.key === "government"
          ? "civic"
          : "business",
    address,
    city,
    county: countyOf(city) ?? countyOf(cityName.split(" — ")[0]!),
    zip: tags["addr:postcode"]?.trim() || null,
    latitude: el.lat ?? el.center?.lat ?? null,
    longitude: el.lon ?? el.center?.lon ?? null,
    phone: (tags["phone"] ?? tags["contact:phone"] ?? "").trim() || null,
    email: (tags["email"] ?? tags["contact:email"] ?? "").trim() || null,
    website: website && /^https?:\/\//i.test(website) ? website : null,
    hours: tags["opening_hours"]?.trim() || null,
    accessibility:
      tags["wheelchair"] === "yes"
        ? "Wheelchair accessible"
        : tags["wheelchair"] === "limited"
          ? "Limited accessibility"
          : null,
    deity,
    events_url: tags["contact:calendar"] ?? tags["website:events"] ?? null,
  };
}

/* ------------------------------ ingest ------------------------------ */

export interface DirectoryIngestReport {
  ok: boolean;
  preview: boolean;
  cities: string[];
  categories: string[];
  queriesRun: number;
  queriesPlanned: number;
  discovered: number;
  added: number;
  updated: number;
  duplicatesMerged: number;
  duplicatesSkipped: number;
  incomplete: number;
  needsReview: number;
  errors: string[];
  perCategory: { path: string; discovered: number; added: number; updated: number }[];
  sample: { name: string; city: string; category: string; address: string | null }[];
}

type ExistingRow = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  hours: string | null;
  email: string | null;
  category: string;
  subcategory: string | null;
  extra_categories: string[] | null;
  community_tags: string[] | null;
  osm_id: string | null;
  verified_status: boolean;
};

const SELECT_EXISTING =
  "id, slug, name, city, address, phone, website, latitude, longitude, description, hours, email, category, subcategory, extra_categories, community_tags, osm_id, verified_status";

export interface IngestOptions {
  counties?: string[] | undefined;
  cities?: string[] | undefined;
  categories?: string[] | undefined;
  subcategories?: string[] | undefined;
  /** Hard cap on Overpass calls in one run, keeping each run inside the worker budget. */
  maxQueries?: number | undefined;
  perQuery?: number | undefined;
  preview?: boolean | undefined;
  /** Skip (city, subcategory) pairs synced within this many days. */
  staleDays?: number | undefined;
}

export async function ingestDirectoryFromOsm(
  db: Db,
  options: IngestOptions = {},
): Promise<DirectoryIngestReport> {
  const cities = resolveGeography({ counties: options.counties, cities: options.cities });
  const pairs = osmSubcategories(options.categories).filter(
    ({ sub }) => !options.subcategories?.length || options.subcategories.includes(sub.key),
  );
  const maxQueries = Math.min(Math.max(options.maxQueries ?? 12, 1), 60);
  const perQuery = Math.min(Math.max(options.perQuery ?? 60, 5), 300);
  const preview = options.preview === true;

  const report: DirectoryIngestReport = {
    ok: true,
    preview,
    cities: cities.map((c) => c.name),
    categories: [...new Set(pairs.map((p) => p.category.key))],
    queriesRun: 0,
    queriesPlanned: cities.length * pairs.length,
    discovered: 0,
    added: 0,
    updated: 0,
    duplicatesMerged: 0,
    duplicatesSkipped: 0,
    incomplete: 0,
    needsReview: 0,
    errors: [],
    perCategory: [],
    sample: [],
  };
  if (cities.length === 0 || pairs.length === 0) {
    report.ok = false;
    report.errors.push("Select at least one city or county and one category with open-data coverage.");
    return report;
  }

  const { data: existingRows, error: existingError } = await db
    .from("directory_entities")
    .select(SELECT_EXISTING)
    .limit(40000);
  if (existingError) throw existingError;

  const rows = (existingRows ?? []) as unknown as ExistingRow[];
  const byOsm = new Map<string, ExistingRow>();
  const byKey = new Map<string, ExistingRow>();
  for (const row of rows) {
    if (row.osm_id) byOsm.set(row.osm_id, row);
    for (const key of dupeKeys({
      name: row.name,
      city: row.city,
      address: row.address,
      phone: row.phone,
      website: row.website,
      latitude: row.latitude,
      longitude: row.longitude,
    })) {
      if (!byKey.has(key)) byKey.set(key, row);
    }
  }

  const now = new Date().toISOString();
  const seen = new Set<string>();
  const lines = new Map<string, { path: string; discovered: number; added: number; updated: number }>();

  outer: for (const city of cities) {
    for (const { category, sub } of pairs) {
      if (report.queriesRun >= maxQueries) break outer;
      report.queriesRun += 1;
      let elements: OsmElement[] = [];
      try {
        elements = await fetchPois(city, sub.osm!);
      } catch (e) {
        report.ok = false;
        report.errors.push(
          `${city.name} / ${sub.label}: ${e instanceof Error ? e.message : "Overpass error"}`,
        );
        continue;
      }

      const path = `${category.key}:${sub.key}`;
      const line = lines.get(path) ?? { path, discovered: 0, added: 0, updated: 0 };
      lines.set(path, line);
      let written = 0;

      for (const el of elements.slice(0, perQuery * 3)) {
        const mapped = mapElement(el, category, sub, city.name);
        if (!mapped) continue;
        if (seen.has(mapped.osm_id)) continue;
        seen.add(mapped.osm_id);

        report.discovered += 1;
        line.discovered += 1;
        if (report.sample.length < 15) {
          report.sample.push({
            name: mapped.name,
            city: mapped.city,
            category: `${category.label} · ${sub.label}`,
            address: mapped.address,
          });
        }
        const incomplete = isIncomplete({
          address: mapped.address,
          phone: mapped.phone,
          website: mapped.website,
          hours: mapped.hours,
        });
        if (incomplete) report.incomplete += 1;

        const keys = dupeKeys(mapped);
        const match =
          byOsm.get(mapped.osm_id) ?? keys.map((k) => byKey.get(k)).find((r) => !!r) ?? null;

        if (match) {
          // Same business from another source or an earlier run: merge, never duplicate.
          if (!byOsm.has(mapped.osm_id)) report.duplicatesMerged += 1;
          if (preview) {
            report.updated += 1;
            line.updated += 1;
            continue;
          }
          const patch: Record<string, unknown> = {
            osm_id: match.osm_id ?? mapped.osm_id,
            attribution: OSM_ATTRIBUTION,
            last_synced_at: now,
          };
          if (!match.address && mapped.address) patch["address"] = mapped.address;
          if (!match.phone && mapped.phone) patch["phone"] = mapped.phone;
          if (!match.website && mapped.website) patch["website"] = mapped.website;
          if (!match.email && mapped.email) patch["email"] = mapped.email;
          if (!match.hours && mapped.hours) patch["hours"] = mapped.hours;
          if (!match.description && mapped.description) patch["description"] = mapped.description;
          if (match.latitude == null && mapped.latitude != null) {
            patch["latitude"] = mapped.latitude;
            patch["longitude"] = mapped.longitude;
          }
          // Multi-category membership grows; the primary category is never overwritten.
          const extras = new Set([
            ...(match.extra_categories ?? []),
            ...mapped.extra_categories,
            ...(match.category === mapped.category && match.subcategory === mapped.subcategory
              ? []
              : [`${mapped.category}:${mapped.subcategory}`]),
          ]);
          extras.delete(`${match.category}:${match.subcategory}`);
          patch["extra_categories"] = [...extras];
          const tags = new Set([...(match.community_tags ?? []), ...mapped.community_tags]);
          patch["community_tags"] = [...tags];

          const { error } = await db
            .from("directory_entities")
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

        if (written >= perQuery) {
          report.duplicatesSkipped += 1;
          continue;
        }
        written += 1;

        if (preview) {
          report.added += 1;
          line.added += 1;
          continue;
        }

        const needsReview = incomplete && !mapped.website;
        if (needsReview) report.needsReview += 1;

        const { data: inserted, error } = await db
          .from("directory_entities")
          .insert({
            entity_type: mapped.entity_type,
            category: mapped.category,
            subcategory: mapped.subcategory,
            extra_categories: mapped.extra_categories,
            community_tags: mapped.community_tags,
            service_tags: mapped.service_tags,
            slug: mapped.slug,
            name: mapped.name,
            description: mapped.description,
            address: mapped.address,
            city: mapped.city,
            county: mapped.county,
            zip: mapped.zip,
            latitude: mapped.latitude,
            longitude: mapped.longitude,
            phone: mapped.phone,
            email: mapped.email,
            website: mapped.website,
            hours: mapped.hours,
            accessibility: mapped.accessibility,
            deity: mapped.deity,
            events_url: mapped.events_url,
            status: "published",
            needs_review: needsReview,
            source: "osm",
            source_id: mapped.osm_id,
            osm_id: mapped.osm_id,
            attribution: OSM_ATTRIBUTION,
            dedupe_key: primaryDupeKey(mapped),
            last_synced_at: now,
          } as never)
          .select("id")
          .single();
        if (error) {
          report.errors.push(`${mapped.name}: ${error.message}`);
          continue;
        }
        // Cache the real row so a later hit in the same run merges instead of
        // trying to update a placeholder id.
        const cached = {
          ...(mapped as unknown as ExistingRow),
          id: (inserted as { id: string } | null)?.id ?? "",
        } as ExistingRow;
        if (cached.id) {
          byOsm.set(mapped.osm_id, cached);
          for (const key of keys) if (!byKey.has(key)) byKey.set(key, cached);
        }

        report.added += 1;
        line.added += 1;
      }
    }
  }

  report.perCategory = [...lines.values()].sort((a, b) => b.discovered - a.discovered);
  return report;
}

/** Coverage snapshot for the ingest desk: rows per category and per county. */
export async function directoryCoverage(db: Db) {
  const { data, error } = await db
    .from("directory_entities")
    .select("category, county, city, source, needs_review, last_synced_at")
    .eq("status", "published")
    .limit(40000);
  if (error) throw error;
  const rows = (data ?? []) as {
    category: string;
    county: string | null;
    city: string | null;
    source: string;
    needs_review: boolean;
    last_synced_at: string | null;
  }[];

  const byCategory = DIRECTORY_TAXONOMY.map((c) => ({
    key: c.key,
    label: c.label,
    total: rows.filter((r) => r.category === c.key).length,
    needsReview: rows.filter((r) => r.category === c.key && r.needs_review).length,
  }));
  const counties = new Map<string, number>();
  for (const row of rows) {
    const key = row.county ?? "Unassigned";
    counties.set(key, (counties.get(key) ?? 0) + 1);
  }
  const stale = rows.filter((r) => {
    if (!r.last_synced_at) return true;
    return Date.now() - new Date(r.last_synced_at).getTime() > 90 * 864e5;
  }).length;

  return {
    total: rows.length,
    stale,
    needsReview: rows.filter((r) => r.needs_review).length,
    byCategory,
    byCounty: [...counties.entries()]
      .map(([county, total]) => ({ county, total }))
      .sort((a, b) => b.total - a.total),
    sources: [...new Set(rows.map((r) => r.source))],
  };
}
