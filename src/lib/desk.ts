/** Shared, client-safe types for the editorial review desk. */

export type ItemKind = "news" | "event" | "temple";
export type ItemStatus = "pending" | "approved" | "rejected";
export type UploadState = "none" | "queued" | "sent" | "failed";

export type DeskItem = {
  id: string;
  kind: ItemKind;
  citySlug: string;
  title: string;
  summary: string;
  source: string;
  sourceUrl: string;
  /** ISO date the item was collected. */
  collectedAt: string;
  /** Photo attached to the item, when the source carried a usable one. */
  image?: string | null;
  /** Collector-stamped identity so held pictures cannot be mistaken for news. */
  reviewType?: "picture";
  /** The attached artwork was visually checked as exactly one adult woman. */
  soloVerified?: true;
  /** Glamour tags stamped at intake: celebrity, industry/region, event or shoot. */
  star?: string;
  industry?: string;
  event?: string;
  /** Event start / temple seva time. */
  when?: string;
  venue?: string;
  status: ItemStatus;
};

export const KIND_LABEL: Record<ItemKind, string> = {
  news: "News",
  event: "Event",
  temple: "Temple",
};

export const todayISO = () => new Date().toISOString().slice(0, 10);
