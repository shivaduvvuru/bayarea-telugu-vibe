/**
 * Google News RSS items link to news.google.com/rss/articles/<id>, which shows
 * a Google interstitial (and often a "blocked" page) instead of the story.
 * This resolves those wrappers back to the publisher URL.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export function isGoogleNewsUrl(url: string) {
  try {
    return /(^|\.)news\.google\.com$/.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

const cache = new Map<string, string>();

/** Returns the publisher URL, or the original link when resolution fails. */
export async function resolveGoogleNewsUrl(url: string): Promise<string> {
  if (!isGoogleNewsUrl(url)) return url;
  const cached = cache.get(url);
  if (cached) return cached;
  try {
    const id = new URL(url).pathname.split("/").filter(Boolean).pop();
    if (!id) return url;
    const page = await fetch(`https://news.google.com/rss/articles/${id}`, {
      headers: { "User-Agent": UA },
    }).then((r) => r.text());
    const sig = page.match(/data-n-a-sg="([^"]+)"/)?.[1];
    const ts = page.match(/data-n-a-ts="([^"]+)"/)?.[1];
    if (!sig || !ts) return url;

    const inner = JSON.stringify([
      "garturlreq",
      [
        ["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1],
        "X",
        "X",
        1,
        [1, 1, 1],
        1,
        1,
        null,
        0,
        0,
        null,
        0,
      ],
      id,
      Number(ts),
      sig,
    ]);
    const body = new URLSearchParams({
      "f.req": JSON.stringify([[["Fbv4je", inner, null, "generic"]]]),
    });
    const text = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": UA,
      },
      body,
    }).then((r) => r.text());
    const real = text.match(/garturlres\\",\\"(https?:[^\\"]+)/)?.[1];
    if (!real) return url;
    const clean = real.replace(/\\u003d/g, "=").replace(/\\u0026/g, "&");
    cache.set(url, clean);
    return clean;
  } catch {
    return url;
  }
}

/** Resolves a batch of links with light concurrency. */
export async function resolveGoogleNewsUrls(urls: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const targets = [...new Set(urls.filter(isGoogleNewsUrl))];
  const size = 5;
  for (let i = 0; i < targets.length; i += size) {
    const slice = targets.slice(i, i + size);
    const resolved = await Promise.all(slice.map((u) => resolveGoogleNewsUrl(u)));
    slice.forEach((u, idx) => {
      const r = resolved[idx];
      if (r && r !== u) out.set(u, r);
    });
  }
  return out;
}
