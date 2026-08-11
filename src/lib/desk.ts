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
