import type { IngestRow } from "@/lib/cms.server";
import { CITIES, cityBySlug } from "@/lib/desk-cities";
import { classifyIndia } from "@/lib/india-topics";
import { isCinema, CINEMA_SLUG } from "@/lib/cinema-topics";
import { isMicroDrama, MICRO_DRAMA_SLUG } from "@/lib/microdrama-topics";


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

  const title = String(row["title"] ?? "");
  const summary = str(row["summary"]) ?? str(payload["summary"]);
  const linkUrl = str(row["source_url"]) ?? str(payload["sourceUrl"]);
  // Bay Area city rows stay local; everything else gets an India section when it
  // reads as India / immigration / diaspora coverage.
  // Our own WordPress newsroom is first-party local reporting: it is additive to
  // the aggregated digest and must never be reclassified into an India section.
  const source = `${str(row["source"]) ?? str(payload["source"]) ?? ""}`.toLowerCase();
  const firstParty = source.includes("wordpress") || source.includes("telugu times");
  const micro = kind === "news" && !firstParty && isMicroDrama(title, summary, linkUrl);
  const cinema = !micro && kind === "news" && !firstParty && isCinema(title, summary, linkUrl);
  const indiaSlug =
    !cinema && !micro && !firstParty && kind === "news" && !CITIES.some((c) => c.slug === citySlug)
      ? classifyIndia(title, summary, linkUrl)
      : null;


  return {
    source: `editorial-desk:${str(row["source"]) ?? str(payload["source"]) ?? "desk"}`,
    source_ref: `editorial-desk:${itemId}`,
    kind: kind === "temple" ? "announcement" : kind,
    title,
    summary,
    link_url: linkUrl,
    image_url: str(payload["image"]) ?? str(payload["image_url"]),
    city,
    region: citySlug ? (cityBySlug(citySlug)?.region ?? null) : null,
    category:
      kind === "temple"
        ? "temples"
        : kind === "event"
          ? "events"
          : micro
            ? MICRO_DRAMA_SLUG
            : cinema
            ? CINEMA_SLUG
            : (indiaSlug ?? "news"),
    published_at:
      str(row["published_at"]) ??
      (str(row["digest_date"]) ? `${str(row["digest_date"])}T00:00:00Z` : null),
  };
}

