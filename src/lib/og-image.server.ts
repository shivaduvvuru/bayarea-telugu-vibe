/**
 * Article artwork fallback.
 *
 * Feeds often omit artwork. Rather than hide the story, the resolved publisher
 * page is fetched once and its social-card image is used: og:image, then
 * twitter:image, then <link rel="image_src">. Results are cached in
 * `url_resolutions.image_url` so a URL is never fetched twice across runs.
 *
 * Unresolved Google News wrappers are never fetched — there is no publisher
 * page behind them.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const TIMEOUT_MS = 5_000;
/** Only the head matters; stop reading well before a full page. */
const MAX_BYTES = 512 * 1024;
export const IMAGE_FETCH_CONCURRENCY = 6;

export type ImageSource = "feed" | "og" | "placeholder";

export type ImageItem = {
  link: string;
  image: string | null;
  unresolved?: boolean;
  imageSource?: ImageSource;
};

export type ImageFallbackCounts = {
  image_feed: number;
  image_og: number;
  image_placeholder: number;
  image_fetch_failed: number;
};

/** Obvious tracking pixels and non-photo assets. */
const PIXEL = /(?:1x1|pixel|spacer)/i;

/** Absolute https URL that is plausibly a real photo hosted for this article. */
export function validImageCandidate(
  candidate: string | null | undefined,
  articleUrl: string,
): string | null {
  if (!candidate) return null;
  let url: URL;
  try {
    url = new URL(candidate.trim(), articleUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const full = url.toString();
  if (PIXEL.test(full)) return null;
  if (/\.gif(?:$|\?)/i.test(url.pathname + url.search)) return null;
  // Host check is deliberately forgiving: publishers serve artwork from many
  // CDNs, so only a clearly unrelated host is rejected when in doubt we keep it.
  return full;
}

function meta(html: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = re.exec(html);
    if (m?.[1]) return m[1];
  }
  return null;
}

/** og:image, then twitter:image, then <link rel="image_src">. */
export function extractOgImage(html: string, articleUrl: string): string | null {
  const head = html.slice(0, 200_000);
  const candidates = [
    meta(head, [
      /<meta[^>]+property=["']og:image(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url|:url)?["']/i,
    ]),
    meta(head, [
      /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
    ]),
    meta(head, [/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i]),
  ];
  for (const c of candidates) {
    const ok = validImageCandidate(c, articleUrl);
    if (ok) return ok;
  }
  return null;
}

/** GET the page, HTML only, capped at 512 KB. Returns null on any failure. */
export async function fetchHtmlHead(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    if (!/text\/html/i.test(res.headers.get("content-type") ?? "")) return null;
    const reader = res.body?.getReader();
    if (!reader) return null;
    const decoder = new TextDecoder();
    let out = "";
    let read = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      read += value.byteLength;
      out += decoder.decode(value, { stream: true });
      if (read >= MAX_BYTES || /<\/head>/i.test(out)) break;
    }
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
    return out;
  } catch {
    return null;
  }
}

async function cache() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Deps = {
  /** Injected in tests so no network is touched. */
  fetchHtml?: (url: string) => Promise<string | null>;
  useCache?: boolean;
  placeholder?: string | null;
};

/**
 * Fill in missing artwork in place and return the funnel counts. Items keep
 * their feed image when they have one; everything else falls back to the desk
 * placeholder, so an item is never dropped for lacking a picture.
 */
export async function backfillItemImages(
  items: ImageItem[],
  deps: Deps = {},
): Promise<ImageFallbackCounts> {
  const fetchHtml = deps.fetchHtml ?? fetchHtmlHead;
  const useCache = deps.useCache ?? true;
  const placeholder = deps.placeholder ?? null;
  const counts: ImageFallbackCounts = {
    image_feed: 0,
    image_og: 0,
    image_placeholder: 0,
    image_fetch_failed: 0,
  };

  const needing: ImageItem[] = [];
  for (const item of items) {
    if (item.image) {
      item.imageSource = "feed";
      counts.image_feed += 1;
      continue;
    }
    // No publisher page behind an unresolved wrapper: never fetch it.
    if (item.unresolved || !item.link) {
      item.image = placeholder;
      item.imageSource = "placeholder";
      counts.image_placeholder += 1;
      continue;
    }
    needing.push(item);
  }
  if (!needing.length) return counts;

  const urls = [...new Set(needing.map((i) => i.link))];
  const found = new Map<string, string>();
  let client: Awaited<ReturnType<typeof cache>> | null = null;
  if (useCache) {
    try {
      client = await cache();
      const { data } = await client
        .from("url_resolutions")
        .select("google_url, image_url")
        .in("google_url", urls);
      for (const row of (data ?? []) as { google_url: string; image_url: string | null }[]) {
        if (row.image_url) found.set(row.google_url, row.image_url);
      }
    } catch {
      client = null;
    }
  }

  const queue = urls.filter((u) => !found.has(u));
  const fresh = new Map<string, string>();
  const workers = Array.from(
    { length: Math.min(IMAGE_FETCH_CONCURRENCY, queue.length) },
    async () => {
      for (;;) {
        const url = queue.shift();
        if (!url) return;
        const html = await fetchHtml(url);
        const image = html ? extractOgImage(html, url) : null;
        if (image) fresh.set(url, image);
      }
    },
  );
  await Promise.all(workers);
  for (const [url, image] of fresh) found.set(url, image);

  for (const item of needing) {
    const image = found.get(item.link);
    if (image) {
      item.image = image;
      item.imageSource = "og";
      counts.image_og += 1;
    } else {
      item.image = placeholder;
      item.imageSource = "placeholder";
      counts.image_placeholder += 1;
      counts.image_fetch_failed += 1;
    }
  }

  if (client && fresh.size) {
    const now = new Date().toISOString();
    try {
      await client.from("url_resolutions").upsert(
        [...fresh].map(([google_url, image_url]) => ({
          google_url,
          resolved_url: google_url,
          image_url,
          resolved_at: now,
        })),
        { onConflict: "google_url" },
      );
    } catch {
      /* cache write is best-effort */
    }
  }

  return counts;
}
