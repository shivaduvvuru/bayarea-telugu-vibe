import { describe, expect, it } from "vitest";
import { DESK_CAPS, capByRecency, deskCap, isGalleryTitle, selectDeskItems, takeUpTo } from "./desk-caps";

type Item = { id: string; published_at: string | null };

/** 60 cinema items spread over three feeds, newest first inside each feed. */
function cinemaItems(): Item[] {
  const out: Item[] = [];
  for (let feed = 0; feed < 3; feed += 1) {
    for (let i = 0; i < 20; i += 1) {
      const minutes = feed * 20 + i; // 0 = newest, 59 = oldest
      out.push({
        id: `f${feed}-i${i}`,
        published_at: new Date(Date.UTC(2026, 7, 27, 0, 0, 0) - minutes * 60_000).toISOString(),
      });
    }
  }
  return out;
}

describe("per-desk caps", () => {
  it("caps cinema at 40 and drops the oldest 20", () => {
    const items = cinemaItems();
    expect(items).toHaveLength(60);
    const { kept, dropped } = capByRecency(items, deskCap("cinema").total);
    expect(kept).toHaveLength(40);
    expect(dropped).toHaveLength(20);
    const keptOldest = Math.min(...kept.map((i) => Date.parse(i.published_at!)));
    const droppedNewest = Math.max(...dropped.map((i) => Date.parse(i.published_at!)));
    expect(keptOldest).toBeGreaterThan(droppedNewest);
    expect(kept[0]!.id).toBe("f0-i0");
  });

  it("stops reading a feed at its per-feed cap", () => {
    const feed = Array.from({ length: 25 }, (_, i) => ({ id: `x${i}`, published_at: null }));
    const { items, capHit } = takeUpTo(feed, deskCap("cinema").perFeed);
    expect(items).toHaveLength(12);
    expect(capHit).toBe(true);

    const small = takeUpTo(feed.slice(0, 5), deskCap("cinema").perFeed);
    expect(small.items).toHaveLength(5);
    expect(small.capHit).toBe(false);
  });

  it("caps a Google News sweep query at 8", () => {
    const sweep = Array.from({ length: 30 }, (_, i) => ({ id: `g${i}`, published_at: null }));
    expect(takeUpTo(sweep, deskCap("cinema").perSweepQuery).items).toHaveLength(8);
  });

  it("leaves micro-drama untouched by the cinema cap", () => {
    expect(deskCap("micro-drama")).toMatchObject({ total: 20, perFeed: 8, perSweepQuery: 8 });
    const items = Array.from({ length: 60 }, (_, i) => ({
      id: `m${i}`,
      published_at: new Date(Date.UTC(2026, 7, 27) - i * 60_000).toISOString(),
    }));
    expect(capByRecency(items, deskCap("micro-drama").total).kept).toHaveLength(20);
  });

  it("keeps news and unknown desks on the previous behaviour", () => {
    expect(deskCap("news").total).toBe(8);
    expect(deskCap("events").total).toBe(8);
    expect(deskCap(undefined)).toEqual(DESK_CAPS.default);
  });
});

describe("gallery downrank and source diversity", () => {
  const item = (id: string, title: string, source: string, minutes: number) => ({
    id,
    title,
    source,
    published_at: new Date(Date.UTC(2026, 7, 28) - minutes * 60_000).toISOString(),
  });

  it("flags gallery titles", () => {
    for (const t of [
      "Latest Photos of the star",
      "New Photos from the sets",
      "Photo Gallery: red carpet",
      "Pics: premiere night",
      "In Pics, the film's first look",
    ]) {
      expect(isGalleryTitle(t)).toBe(true);
    }
    expect(isGalleryTitle("Box office report for the weekend")).toBe(false);
    expect(isGalleryTitle(null)).toBe(false);
  });

  it("caps galleries at 3 and fills them only after real reporting", () => {
    // Galleries are the newest items, so recency alone would keep all 10.
    const galleries = Array.from({ length: 10 }, (_, i) =>
      item(`g${i}`, `Latest Photos ${i}`, `Gallery Site ${i}`, i),
    );
    const stories = Array.from({ length: 30 }, (_, i) =>
      item(`s${i}`, `Cinema story ${i}`, `Trade Site ${i}`, 100 + i),
    );
    const { kept, galleries: galleryCount } = selectDeskItems(
      [...galleries, ...stories],
      deskCap("cinema"),
    );
    expect(galleryCount).toBe(3);
    expect(kept.filter((k) => isGalleryTitle(k.title))).toHaveLength(3);
    // Non-gallery items are placed first, galleries take the tail slots.
    expect(kept.slice(0, 30).every((k) => !isGalleryTitle(k.title))).toBe(true);
    expect(kept).toHaveLength(33);
  });

  it("caps any single source at 8 of the 40 cinema slots", () => {
    const prolific = Array.from({ length: 25 }, (_, i) =>
      item(`p${i}`, `Prolific story ${i}`, "Prolific Feed", i),
    );
    const others = Array.from({ length: 25 }, (_, i) =>
      item(`o${i}`, `Other story ${i}`, `Other Feed ${i}`, 50 + i),
    );
    const { kept, sourceCapDropped } = selectDeskItems([...prolific, ...others], deskCap("cinema"));
    expect(kept).toHaveLength(33);
    expect(kept.filter((k) => k.source === "Prolific Feed")).toHaveLength(8);
    expect(sourceCapDropped).toBe(17);
  });

  it("treats micro-drama with its own 20 total and the same source cap", () => {
    const items = Array.from({ length: 40 }, (_, i) =>
      item(`m${i}`, `Vertical drama ${i}`, i % 2 === 0 ? "Feed A" : "Feed B", i),
    );
    const { kept } = selectDeskItems(items, deskCap("micro-drama"));
    expect(kept).toHaveLength(16);
  });
});
