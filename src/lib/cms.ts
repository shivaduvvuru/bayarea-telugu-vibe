/** Shared, client-safe types and constants for the community CMS. */

export const CONTENT_KINDS = [
  { value: "news", label: "News story" },
  { value: "event", label: "Event" },
  { value: "announcement", label: "Temple / association announcement" },
  { value: "photo", label: "Photo" },
  { value: "classified", label: "Classified" },
  { value: "ad", label: "Advertisement" },
] as const;

export type ContentKind = (typeof CONTENT_KINDS)[number]["value"];

export const PLACEMENTS = [
  { value: "auto", label: "Automatic (let the site decide)" },
  { value: "home_lead", label: "Homepage lead" },
  { value: "home_rail", label: "Homepage rail" },
  { value: "section", label: "Section page only" },
  { value: "hidden", label: "Do not surface" },
] as const;

export type Placement = (typeof PLACEMENTS)[number]["value"];

export type ContentStatus = "published" | "pending" | "removed" | "duplicate";

export type ContentItem = {
  id: string;
  source: string;
  source_ref: string | null;
  kind: string;
  status: string;
  placement: string;
  title: string;
  summary: string | null;
  body: string | null;
  image_url: string | null;
  link_url: string | null;
  city: string | null;
  region: string | null;
  category: string | null;
  event_start: string | null;
  event_end: string | null;
  venue: string | null;
  submitter_name?: string | null;
  submitter_email?: string | null;
  published_at: string | null;
  created_at: string;
  dedupe_key?: string | null;
  duplicate_of?: string | null;
};

/**
 * Columns safe for any reader. Submitter name/email are not part of this table
 * at all: they live in the private content_item_contacts table.
 */
export const PUBLIC_COLUMNS =
  "id, source, source_ref, kind, status, placement, title, summary, body, image_url, link_url, city, region, category, event_start, event_end, venue, published_at, created_at, dedupe_key, duplicate_of";

/**
 * Automatic placement: where an item lands when the submitter or the pull
 * job did not pick a slot. Events go to the events rail, ads to the promo
 * slots, everything else into the community feed.
 */
export function autoSection(item: Pick<ContentItem, "kind">) {
  switch (item.kind) {
    case "event":
      return "events";
    case "ad":
      return "promos";
    case "announcement":
      return "announcements";
    case "photo":
      return "gallery";
    case "classified":
      return "classifieds";
    default:
      return "community";
  }
}