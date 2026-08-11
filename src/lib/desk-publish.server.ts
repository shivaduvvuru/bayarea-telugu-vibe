import type { IngestRow } from "@/lib/cms.server";
import { cityBySlug } from "@/lib/desk-cities";

type Row = Record<string, unknown>;

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

/** Maps a review-desk queue row onto a newsroom ingest row. */
export function deskRowToIngest(row: Row): IngestRow {
  const payload = (row["payload"] ?? {}) as Record<string, unknown>;
  const itemId = String(row["item_id"]);
  const citySlug = str(row["city_slug"]);
  const city = citySlug ? (cityBySlug(citySlug)?.en ?? citySlug) : null;
  const kind = String(row["kind"] ?? "news");

  return {
    source: `editorial-desk:${str(row["source"]) ?? str(payload["source"]) ?? "desk"}`,
    source_ref: `editorial-desk:${itemId}`,
    kind: kind === "temple" ? "announcement" : kind,
    title: String(row["title"] ?? ""),
    summary: str(row["summary"]) ?? str(payload["summary"]),
    link_url: str(row["source_url"]) ?? str(payload["sourceUrl"]),
    image_url: str(payload["image"]),
    city,
    region: citySlug ? (cityBySlug(citySlug)?.region ?? null) : null,
    category: kind === "temple" ? "temples" : kind === "event" ? "events" : "news",
    published_at:
      str(row["published_at"]) ??
      (str(row["digest_date"]) ? `${str(row["digest_date"])}T00:00:00Z` : null),
  };
}
