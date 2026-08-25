/**
 * Canonical key parity tests.
 *
 * Every repeat publisher serves the same story under many URLs: amp copies,
 * utm tracking, trailing slashes, http/https, www. These tests pin the promise
 * the database unique indexes rely on — all of those variants must collapse to
 * one identical key.
 */
import { describe, expect, it } from "vitest";
import { canonicalImage, canonicalUrl, strictTitleKey } from "./dedupe";

/** Every variant in a group must produce the same non-null key. */
function assertSameKey(
  fn: (v: string) => string | null,
  variants: string[],
  label: string,
) {
  const keys = variants.map((v) => fn(v));
  expect(keys[0], `${label}: first variant produced no key`).toBeTruthy();
  for (let i = 1; i < keys.length; i++) {
    expect(keys[i], `${label}: variant ${i} (${variants[i]})`).toBe(keys[0]);
  }
}

describe("canonicalUrl", () => {
  it("collapses Times of India section paths, amp and tracking to the article id", () => {
    assertSameKey(
      canonicalUrl,
      [
        "https://timesofindia.indiatimes.com/city/hyderabad/metro-rail-phase-2-nod/articleshow/112233445.cms",
        "http://www.timesofindia.indiatimes.com/city/hyderabad/metro-rail-phase-2-nod/articleshow/112233445.cms/",
        "https://timesofindia.indiatimes.com/city/hyderabad/metro-rail-phase-2-nod/articleshow/112233445.cms?utm_source=whatsapp&utm_medium=social",
        "https://timesofindia.indiatimes.com/city/hyderabad/metro-rail-phase-2-nod/articleshow/112233445.cms/amp",
        "https://timesofindia.indiatimes.com/amp_articleshow/articleshow/112233445.cms#comments",
        "https://TIMESOFINDIA.indiatimes.com/business/india-business/metro-nod/articleshow/112233445.cms",
      ],
      "toi",
    );
    expect(
      canonicalUrl("https://timesofindia.indiatimes.com/city/hyderabad/x/articleshow/112233445.cms"),
    ).toBe("timesofindia.indiatimes.com/articleshow/112233445.cms");
  });

  it("keeps distinct Times of India articles distinct", () => {
    expect(
      canonicalUrl("https://timesofindia.indiatimes.com/x/articleshow/112233445.cms"),
    ).not.toBe(canonicalUrl("https://timesofindia.indiatimes.com/x/articleshow/999999999.cms"));
  });

  it.each([
    [
      "indianexpress",
      [
        "https://indianexpress.com/article/cities/hyderabad/orr-toll-hike-9876543/",
        "http://www.indianexpress.com/article/cities/hyderabad/orr-toll-hike-9876543",
        "https://indianexpress.com/article/cities/hyderabad/orr-toll-hike-9876543/?utm_campaign=feed&utm_source=rss",
        "https://indianexpress.com/article/cities/hyderabad/orr-toll-hike-9876543/amp",
        "https://indianexpress.com/article/cities/hyderabad/orr-toll-hike-9876543/amp/",
        "https://indianexpress.com/article/cities/hyderabad/orr-toll-hike-9876543/#respond",
      ],
    ],
    [
      "thehindu",
      [
        "https://www.thehindu.com/news/cities/Hyderabad/rtc-fare-revision/article12345678.ece",
        "https://thehindu.com/news/cities/Hyderabad/rtc-fare-revision/article12345678.ece/",
        "https://www.thehindu.com/news/cities/Hyderabad/rtc-fare-revision/article12345678.ece?homepage=true",
        "http://www.thehindu.com/news/cities/Hyderabad/rtc-fare-revision/article12345678.ece/amp",
      ],
    ],
    [
      "mercurynews",
      [
        "https://www.mercurynews.com/2026/08/10/san-jose-housing-plan/",
        "https://mercurynews.com/2026/08/10/san-jose-housing-plan",
        "https://www.mercurynews.com/2026/08/10/san-jose-housing-plan/?share=twitter",
        "https://www.mercurynews.com/2026/08/10/san-jose-housing-plan/amp/",
      ],
    ],
    [
      "ndtv",
      [
        "https://www.ndtv.com/india-news/telangana-cabinet-expansion-5566778",
        "https://ndtv.com/india-news/telangana-cabinet-expansion-5566778/",
        "https://www.ndtv.com/india-news/telangana-cabinet-expansion-5566778?pfrom=home-ndtv_topscroll",
        "https://www.ndtv.com/india-news/telangana-cabinet-expansion-5566778/amp",
      ],
    ],
    [
      "andhrawishesh",
      [
        "https://www.andhrawishesh.com/movies/tollywood-news/esha-deol-latest.html",
        "https://andhrawishesh.com/movies/tollywood-news/esha-deol-latest.html/",
        "http://www.andhrawishesh.com/movies/tollywood-news/esha-deol-latest.html?utm_source=rss&utm_medium=feed",
      ],
    ],
  ])("collapses %s amp/utm/trailing-slash variants", (label, variants) => {
    assertSameKey(canonicalUrl, variants as string[], label);
  });

  it("returns null for empty input", () => {
    expect(canonicalUrl(null)).toBeNull();
    expect(canonicalUrl("")).toBeNull();
    expect(canonicalUrl("   ")).toBeNull();
  });
});

describe("strictTitleKey", () => {
  it("collapses punctuation, curly quotes, dashes and spacing variants", () => {
    assertSameKey(
      (v) => strictTitleKey(v),
      [
        "Metro Rail Phase 2 gets Centre's nod — 5 corridors cleared",
        "Metro Rail Phase 2 gets Centre\u2019s nod \u2014 5 corridors cleared",
        "metro rail phase 2 gets centre s nod   5 corridors cleared",
        "Metro Rail Phase 2 Gets Centre's Nod – 5 Corridors Cleared!",
        "  Metro  Rail   Phase 2 gets Centre's nod... 5 corridors cleared  ",
      ],
      "headline",
    );
  });

  it("keeps different headlines apart", () => {
    expect(strictTitleKey("ORR toll hiked by 10%")).not.toBe(
      strictTitleKey("ORR toll hiked by 20%"),
    );
  });

  it("returns null when nothing survives normalisation", () => {
    expect(strictTitleKey("—  !!! ")).toBeNull();
    expect(strictTitleKey(null)).toBeNull();
  });
});

describe("canonicalImage", () => {
  it("collapses every Times of India crop to the photo msid", () => {
    assertSameKey(
      canonicalImage,
      [
        "https://static.toiimg.com/thumb/msid-112233445,width-1070,height-580,imgsize-45678,resizemode-75/metro.jpg",
        "http://static.toiimg.com/photo/msid-112233445.cms",
        "https://static.toiimg.com/thumb/msid-112233445,width-400,resizemode-4/metro.jpg?v=2",
      ],
      "toi-image",
    );
    expect(
      canonicalImage("https://static.toiimg.com/photo/msid-112233445.cms"),
    ).toBe("msid-112233445");
  });

  it("strips size suffixes and query strings from other publishers", () => {
    assertSameKey(
      canonicalImage,
      [
        "https://images.indianexpress.com/2026/08/orr-toll.jpg",
        "http://www.images.indianexpress.com/2026/08/orr-toll.jpg?w=640&resize=640,360".replace(
          "www.",
          "",
        ),
        "https://images.indianexpress.com/2026/08/orr-toll-1200x800.jpg",
        "https://images.indianexpress.com/2026/08/orr-toll_600x400.jpg#hero",
      ],
      "ie-image",
    );
  });

  it("keeps different photos apart", () => {
    expect(canonicalImage("https://cdn.x.com/a.jpg")).not.toBe(
      canonicalImage("https://cdn.x.com/b.jpg"),
    );
    expect(canonicalImage(null)).toBeNull();
  });
});
