import { describe, expect, it } from "vitest";
import { classifyDeskItem, CINEMA_HOSTS } from "./cinema-topics";

/**
 * Pure classifier tests — no network. Google News resolution is represented by
 * the `url` / `unresolved` inputs, exactly as the resolver reports them.
 */
const resolver = (link: string) =>
  link.includes("news.google.com")
    ? { url: link, unresolved: true }
    : { url: link, unresolved: false };

describe("classifyDeskItem", () => {
  it("maps a Variety URL to cinema via the host map", () => {
    const r = resolver("https://variety.com/2026/film/news/box-office-weekend-1234/");
    expect(classifyDeskItem({ title: "Weekend report", url: r.url, unresolved: r.unresolved, sweep: "cinema" }))
      .toEqual({ category: "cinema", reason: "host-map" });
  });

  it("routes a ReelShort title to micro-drama on keyword", () => {
    const r = resolver("https://example.com/story");
    expect(
      classifyDeskItem({
        title: "ReelShort tops the vertical drama charts as micro-drama spending climbs",
        url: r.url,
        unresolved: r.unresolved,
        sweep: "cinema",
      }),
    ).toEqual({ category: "micro-drama", reason: "keyword" });
  });

  it("keeps an unresolved Google News link from a cinema sweep on the cinema desk", () => {
    const r = resolver("https://news.google.com/rss/articles/CBMiXk9wYXF1ZQ");
    expect(
      classifyDeskItem({
        title: "Producer signs three-picture deal",
        sourceName: "Some Trade Site",
        url: r.url,
        unresolved: r.unresolved,
        sweep: "cinema",
      }),
    ).toEqual({ category: "cinema", reason: "sweep-default" });
  });

  it("leaves a plain Reuters link on news", () => {
    const r = resolver("https://www.reuters.com/world/india/policy-update-2026-08-27/");
    expect(
      classifyDeskItem({
        title: "Reserve Bank holds rates steady",
        sourceName: "Reuters",
        url: r.url,
        unresolved: r.unresolved,
      }),
    ).toEqual({ category: "news", reason: "fallback" });
  });

  it("never defaults a trade host to micro-drama", () => {
    expect(
      classifyDeskItem({ title: "Studio slate revealed", url: "https://deadline.com/2026/08/slate/" }).category,
    ).toBe("cinema");
  });

  it("exposes the host map", () => {
    expect(CINEMA_HOSTS).toContain("variety.com");
    expect(CINEMA_HOSTS).toContain("ottplay.com");
  });
});
