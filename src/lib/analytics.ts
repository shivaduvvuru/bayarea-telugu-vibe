/**
 * Analytics event plan. Every interaction the product team wants to measure
 * goes through `track()`, so a provider (GA4, Plausible, Umami) can be wired
 * up in one place later. Until then events are buffered on `window` and
 * logged in development.
 */
export type AnalyticsEvent =
  | "article_read"
  | "video_view"
  | "event_save"
  | "event_calendar_add"
  | "event_directions"
  | "event_register"
  | "directory_click"
  | "share"
  | "save"
  | "photo_favorite"
  | "photo_dislike"

  | "newsletter_signup"
  | "poll_vote"
  | "language_switch"
  | "deal_click";

type Payload = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    tbaEvents?: { event: AnalyticsEvent; payload: Payload; at: number }[];
  }
}

export function track(event: AnalyticsEvent, payload: Payload = {}) {
  if (typeof window === "undefined") return;
  window.tbaEvents ??= [];
  window.tbaEvents.push({ event, payload, at: Date.now() });
  window.dataLayer?.push({ event, ...payload });
  if (import.meta.env.DEV) console.debug("[analytics]", event, payload);
}