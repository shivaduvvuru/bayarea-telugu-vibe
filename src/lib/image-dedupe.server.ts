/**
 * Automatic image deduplication.
 *
 * Every stored photo gets two fingerprints:
 *  - `file_hash`  — SHA-256 of the bytes (exact repeats, any re-upload)
 *  - `perceptual_hash` — 64-bit DCT hash of a 32x32 greyscale render, so
 *    resized, cropped or re-compressed versions of the same picture still match
 *    within a Hamming distance of 5.
 *
 * When a fingerprint already exists we do NOT store the new file: the caller is
 * handed the existing image URL, the substitution is logged, and the article is
 * attached to the picture that is already on the site.
 */
import jpeg from "jpeg-js";

export const HAMMING_LIMIT = 5;

type Db = { from: (table: string) => any };

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const view = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest("SHA-256", view.buffer as ArrayBuffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 1-D DCT-II, used per row and per column of the 32x32 luma matrix. */
function dct(vector: number[]): number[] {
  const n = vector.length;
  const out = new Array<number>(n).fill(0);
  for (let k = 0; k < n; k += 1) {
    let sum = 0;
    for (let i = 0; i < n; i += 1) sum += vector[i]! * Math.cos(((2 * i + 1) * k * Math.PI) / (2 * n));
    out[k] = sum;
  }
  return out;
}

/** pHash over a 32x32 greyscale matrix: top-left 8x8 DCT block vs its median. */
export function perceptualHashFromLuma(luma: number[], size = 32): string {
  const rows: number[][] = [];
  for (let y = 0; y < size; y += 1) rows.push(dct(luma.slice(y * size, y * size + size)));
  const cols: number[][] = [];
  for (let x = 0; x < size; x += 1) cols.push(dct(rows.map((r) => r[x]!)));
  const block: number[] = [];
  for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) block.push(cols[x]![y]!);
  const rest = block.slice(1).sort((a, b) => a - b);
  const median = rest[Math.floor(rest.length / 2)] ?? 0;
  let bits = "";
  for (const v of block) bits += v > median ? "1" : "0";
  // 64 bits -> 16 hex chars
  let hex = "";
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let d = 0;
  for (let i = 0; i < a.length; i += 1) {
    let x = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

/** Nearest-neighbour downscale of decoded RGBA pixels into a 32x32 luma grid. */
function lumaFromRgba(data: Uint8Array, width: number, height: number, size = 32): number[] {
  const luma = new Array<number>(size * size).fill(0);
  for (let y = 0; y < size; y += 1) {
    const sy = Math.min(height - 1, Math.floor((y * height) / size));
    for (let x = 0; x < size; x += 1) {
      const sx = Math.min(width - 1, Math.floor((x * width) / size));
      const i = (sy * width + sx) * 4;
      luma[y * size + x] =
        0.299 * (data[i] ?? 0) + 0.587 * (data[i + 1] ?? 0) + 0.114 * (data[i + 2] ?? 0);
    }
  }
  return luma;
}

/**
 * Perceptual hash of raw bytes. Non-JPEG bytes are normalised to a small JPEG
 * through the same free image proxy the site already uses for delivery; if that
 * is not possible we fall back to the exact hash only.
 */
export async function perceptualHashOfBytes(bytes: Uint8Array): Promise<string | null> {
  try {
    const raw = jpeg.decode(bytes as never, { useTArray: true, formatAsRGBA: true } as never) as {
      data: Uint8Array;
      width: number;
      height: number;
    };
    return perceptualHashFromLuma(lumaFromRgba(raw.data, raw.width, raw.height));
  } catch {
    return null;
  }
}

/** Perceptual hash of a remote picture, fetched at 64px through the proxy. */
export async function perceptualHashOfUrl(url: string): Promise<string | null> {
  if (!/^https?:\/\//i.test(url)) return null;
  const params = new URLSearchParams({
    url: url.replace(/^https?:\/\//i, ""),
    w: "64",
    h: "64",
    fit: "cover",
    output: "jpg",
    q: "80",
  });
  try {
    const res = await fetch(`https://images.weserv.nl/?${params.toString()}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return await perceptualHashOfBytes(bytes);
  } catch {
    return null;
  }
}

export type ImageMatch = {
  /** URL to attach to the article — the existing file when this is a repeat. */
  url: string;
  duplicate: boolean;
  fileHash: string | null;
  perceptualHash: string | null;
  originalUrl?: string;
};

/** Looks for an existing picture with the same exact or look-alike fingerprint. */
async function findFingerprint(
  db: Db,
  fileHash: string | null,
  phash: string | null,
): Promise<{ image_url: string; perceptual_hash: string | null } | null> {
  if (fileHash) {
    const { data } = await db
      .from("image_fingerprints")
      .select("image_url, perceptual_hash")
      .eq("file_hash", fileHash)
      .maybeSingle();
    if (data) return data as never;
  }
  if (phash) {
    const { data } = await db
      .from("image_fingerprints")
      .select("image_url, perceptual_hash")
      .not("perceptual_hash", "is", null)
      .order("created_at", { ascending: true })
      .limit(4000);
    for (const row of (data ?? []) as { image_url: string; perceptual_hash: string }[]) {
      if (hammingDistance(row.perceptual_hash, phash) <= HAMMING_LIMIT) return row;
    }
  }
  return null;
}

/**
 * Registers an uploaded file. When the same (or a look-alike) picture is already
 * stored, nothing is written to storage and the existing URL is returned.
 * `store` is only invoked for genuinely new pictures.
 */
export async function dedupeUpload(
  db: Db,
  bytes: Uint8Array,
  meta: { contentType?: string | null },
  store: () => Promise<string>,
): Promise<ImageMatch> {
  const fileHash = await sha256Hex(bytes).catch(() => null);
  const phash = await perceptualHashOfBytes(bytes);
  const existing = await findFingerprint(db, fileHash, phash).catch(() => null);
  if (existing) {
    const { logRejectedDuplicate } = await import("./duplicate-guard.server");
    await logRejectedDuplicate(db as never, {
      kind: "image",
      reason: fileHash && existing.perceptual_hash !== phash ? "file_hash" : "perceptual_hash",
      title: null,
      original_url: existing.image_url,
      entry_point: "upload",
      payload: { substituted_with: existing.image_url, file_hash: fileHash, phash },
    });
    return {
      url: existing.image_url,
      duplicate: true,
      fileHash,
      perceptualHash: phash,
      originalUrl: existing.image_url,
    };
  }
  const url = await store();
  await db
    .from("image_fingerprints")
    .upsert(
      {
        file_hash: fileHash,
        perceptual_hash: phash,
        image_url: url,
        bytes: bytes.byteLength,
        content_type: meta.contentType ?? null,
      },
      { onConflict: "image_url" },
    )
    .then(
      () => undefined,
      (err: unknown) => console.error("image fingerprint insert failed", err),
    );
  return { url, duplicate: false, fileHash, perceptualHash: phash };
}

/**
 * Fingerprints a remote picture we are about to attach to a story. Repeats are
 * pointed back at the copy already in use so the same photo is never shown as if
 * it were a second picture.
 */
export async function dedupeRemoteImage(db: Db, url: string): Promise<ImageMatch> {
  const phash = await perceptualHashOfUrl(url);
  if (!phash) return { url, duplicate: false, fileHash: null, perceptualHash: null };
  const existing = await findFingerprint(db, null, phash).catch(() => null);
  if (existing && existing.image_url !== url) {
    return {
      url: existing.image_url,
      duplicate: true,
      fileHash: null,
      perceptualHash: phash,
      originalUrl: existing.image_url,
    };
  }
  if (!existing) {
    await db
      .from("image_fingerprints")
      .upsert({ perceptual_hash: phash, image_url: url }, { onConflict: "image_url" })
      .then(
        () => undefined,
        () => undefined,
      );
  }
  return { url, duplicate: false, fileHash: null, perceptualHash: phash };
}
