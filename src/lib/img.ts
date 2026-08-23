/**
 * Remote publisher photos are served straight from origin sites at full size
 * (often 1500px+ JPEG). We route them through a free image proxy that resizes
 * and re-encodes to WebP/AVIF so mobile clients download ~10x less.
 */
const PROXY = "https://images.weserv.nl/";

/** Widths we generate for responsive srcsets. */
export const IMG_WIDTHS = [320, 480, 640, 960, 1280] as const;

function isRemote(src: string) {
  return /^https?:\/\//i.test(src);
}

/** Already-optimised or non-proxyable sources are returned untouched. */
function shouldSkip(src: string) {
  if (!src) return true;
  if (!isRemote(src)) return true; // data:, blob:, /local.png
  if (src.startsWith(PROXY)) return true;
  if (/\.svg($|\?)/i.test(src)) return true;
  return false;
}

/** A single resized + re-encoded variant of a remote image. */
export function cdnImage(src: string | null | undefined, width = 960, quality = 72) {
  if (!src || shouldSkip(src)) return src ?? "";
  const params = new URLSearchParams({
    url: src.replace(/^https?:\/\//i, ""),
    w: String(width),
    q: String(quality),
    output: "webp",
    we: "", // never upscale beyond the source
    af: "", // adaptive filtering keeps text-in-image readable
  });
  return `${PROXY}?${params.toString()}`;
}

/** Responsive srcset across IMG_WIDTHS; empty string when not proxyable. */
export function cdnSrcSet(src: string | null | undefined, quality = 72) {
  if (!src || shouldSkip(src)) return undefined;
  return IMG_WIDTHS.map((w) => `${cdnImage(src, w, quality)} ${w}w`).join(", ");
}
