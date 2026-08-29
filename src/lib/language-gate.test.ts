import { describe, expect, it } from "vitest";
import { isEnglishTitle, isNonEnglishTitle, latinLetterShare } from "./language-gate";

describe("English-only gate", () => {
  it("drops Telugu-script headlines", () => {
    expect(isEnglishTitle("ది ప్యారడైజ్ మూవీ రివ్యూ")).toBe(false);
    expect(isNonEnglishTitle("ప్రభాస్ కొత్త సినిమా అప్‌డేట్")).toBe(true);
  });

  it("keeps English headlines about Telugu cinema", () => {
    expect(isEnglishTitle("The Paradise teaser: Nani goes raw in Telugu cinema's biggest swing")).toBe(true);
    expect(isEnglishTitle("Tollywood box office: Telugu OTT release list for this week")).toBe(true);
    expect(isNonEnglishTitle("Prabhas' next Telugu movie review is out")).toBe(false);
  });

  it("drops Devanagari, Tamil and CJK headlines too", () => {
    for (const t of ["बॉलीवुड फिल्म समीक्षा", "தமிழ் சினிமா செய்திகள்", "短剧行业新闻", "숏드라마 뉴스"]) {
      expect(isEnglishTitle(t)).toBe(false);
    }
  });

  it("keeps mostly-English titles that carry a native-script word", () => {
    expect(isEnglishTitle("Telugu movie 'సలార్' crosses 100 crore at the box office worldwide")).toBe(true);
  });

  it("treats empty or letterless titles as not English", () => {
    expect(isEnglishTitle("")).toBe(false);
    expect(isEnglishTitle(null)).toBe(false);
    expect(isEnglishTitle("2026 — 100%")).toBe(false);
    expect(latinLetterShare("abc")).toBe(1);
  });
});
