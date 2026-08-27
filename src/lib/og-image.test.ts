import { describe, expect, it, vi } from "vitest";
import { backfillItemImages, extractOgImage } from "./og-image.server";

const PLACEHOLDER = "/cinema-placeholder.webp";
const opts = (fetchHtml: (url: string) => Promise<string | null>) => ({
  fetchHtml,
  useCache: false,
  placeholder: PLACEHOLDER,
});

describe("extractOgImage", () => {
  it("prefers og:image", () => {
    const html = `<head><meta property="og:image" content="https://cdn.variety.com/a.jpg">
      <meta name="twitter:image" content="https://cdn.variety.com/b.jpg"></head>`;
    expect(extractOgImage(html, "https://variety.com/x")).toBe("https://cdn.variety.com/a.jpg");
  });

  it("falls back to twitter:image, then image_src", () => {
    expect(
      extractOgImage(
        `<meta name="twitter:image" content="https://cdn.deadline.com/b.jpg">`,
        "https://deadline.com/x",
      ),
    ).toBe("https://cdn.deadline.com/b.jpg");
    expect(
      extractOgImage(
        `<link rel="image_src" href="https://cdn.deadline.com/c.jpg">`,
        "https://deadline.com/x",
      ),
    ).toBe("https://cdn.deadline.com/c.jpg");
  });
});

describe("backfillItemImages", () => {
  it("uses og:image when present", async () => {
    const items = [{ link: "https://variety.com/x", image: null }];
    const counts = await backfillItemImages(
      items,
      opts(async () => `<meta property="og:image" content="https://cdn.variety.com/a.jpg">`),
    );
    expect(items[0]!.image).toBe("https://cdn.variety.com/a.jpg");
    expect(items[0]!.imageSource).toBe("og");
    expect(counts.image_og).toBe(1);
  });

  it("uses the twitter card when og:image is missing", async () => {
    const items = [{ link: "https://deadline.com/x", image: null }];
    await backfillItemImages(
      items,
      opts(async () => `<meta name="twitter:image" content="https://cdn.deadline.com/b.jpg">`),
    );
    expect(items[0]!.imageSource).toBe("og");
    expect(items[0]!.image).toBe("https://cdn.deadline.com/b.jpg");
  });

  it("rejects tracking pixels and falls back to the placeholder", async () => {
    const items = [{ link: "https://variety.com/x", image: null }];
    const counts = await backfillItemImages(
      items,
      opts(async () => `<meta property="og:image" content="https://variety.com/1x1.png">`),
    );
    expect(items[0]!.image).toBe(PLACEHOLDER);
    expect(items[0]!.imageSource).toBe("placeholder");
    expect(counts.image_fetch_failed).toBe(1);
  });

  it("never fetches an unresolved Google News link", async () => {
    const fetchHtml = vi.fn(async () => "<meta property=\"og:image\" content=\"https://x/a.jpg\">");
    const items = [
      { link: "https://news.google.com/rss/articles/abc", image: null, unresolved: true },
    ];
    const counts = await backfillItemImages(items, opts(fetchHtml));
    expect(fetchHtml).not.toHaveBeenCalled();
    expect(items[0]!.image).toBe(PLACEHOLDER);
    expect(counts.image_placeholder).toBe(1);
    expect(counts.image_fetch_failed).toBe(0);
  });

  it("keeps a feed image untouched", async () => {
    const fetchHtml = vi.fn(async () => null);
    const items = [{ link: "https://variety.com/x", image: "https://cdn.variety.com/feed.jpg" }];
    const counts = await backfillItemImages(items, opts(fetchHtml));
    expect(fetchHtml).not.toHaveBeenCalled();
    expect(counts.image_feed).toBe(1);
  });
});
