import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

type PhotoCandidate = {
  id: string;
  image: string;
};

/** Machine-readable reasons a photo may be blocked before the review desk. */
export type PhotoRejectReason =
  | "minor_or_age_uncertain"
  | "explicit_content"
  | "no_primary_woman"
  | "image_corrupt"
  | "screen_unavailable";

export type PhotoVerification = {
  /** Cleared for the review desk by an explicit model verdict. */
  accepted: Set<string>;
  /** Blocked with a definitive safety/subject reason. */
  rejected: Set<string>;
  reasons: Map<string, PhotoRejectReason>;
  /** Photos the model could not judge — blocked as screen_unavailable. */
  unchecked: Set<string>;
};

// One image per call keeps the model from swapping ids between photos.
const BATCH_SIZE = 1;
// Visual checks share one workspace rate-limit budget; a few sequential workers
// keep throughput steady without bursts that get throttled.
const MAX_CONCURRENT_CHECKS = 4;

const verdictSchema = z.object({
  id: z.string(),
  isPhotograph: z.boolean(),
  primaryAdultWoman: z.boolean(),
  minorOrAgeUncertain: z.boolean(),
  explicitContent: z.boolean(),
});

/**
 * Many publishers (koimoi, ndtvimg, …) answer 403 to the AI gateway's direct
 * image fetch (hotlink protection). We download the bytes ourselves with a
 * browser-like Referer/User-Agent and hand the model the file, so a blocked
 * hotlink never turns into a silently rejected photo.
 */
async function loadImageBytes(url: string): Promise<Uint8Array | null> {
  try {
    const parsed = new URL(url);
    const res = await fetch(parsed, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        Referer: `${parsed.protocol}//${parsed.hostname}/`,
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.warn(`photo fetch blocked ${res.status} ${url}`);
      return null;
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    return buf.byteLength > 0 ? buf : null;
  } catch (error) {
    console.warn(`photo fetch failed ${url}`, error);
    return null;
  }
}

function parseVerdicts(raw: string) {
  try {
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start < 0 || end < start) return [];
    const parsed = z.array(verdictSchema).safeParse(JSON.parse(raw.slice(start, end + 1)));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/**
 * Safety screen, not a taste filter. A photo reaches the review desk whenever
 * one adult woman is the dominant subject; background passers-by, posters,
 * reflections, crops, orientation, styling and picture quality are irrelevant.
 * Only age doubt, explicit content, a missing female lead subject or an
 * unusable file block a photo. Model failures fail CLOSED: an unavailable
 * screen blocks the photo with "screen_unavailable" rather than admitting it.
 */
export async function verifySoloWomanPhotos(
  candidates: PhotoCandidate[],
  apiKey: string | undefined,
): Promise<PhotoVerification> {
  const accepted = new Set<string>();
  const rejected = new Set<string>();
  const reasons = new Map<string, PhotoRejectReason>();
  const unchecked = new Set(candidates.map((candidate) => candidate.id));
  // No key: the screen cannot run, so nothing is admitted.
  if (!apiKey) {
    for (const candidate of candidates) {
      rejected.add(candidate.id);
      reasons.set(candidate.id, "screen_unavailable");
    }
    return { accepted, rejected, reasons, unchecked };
  }

  const gateway = createLovableAiGatewayProvider(apiKey);
  const batches: PhotoCandidate[][] = [];
  for (let offset = 0; offset < candidates.length; offset += BATCH_SIZE) {
    batches.push(candidates.slice(offset, offset + BATCH_SIZE));
  }
  let nextBatch = 0;
  const worker = async () => {
    while (nextBatch < batches.length) {
      const batch = batches[nextBatch];
      nextBatch += 1;
      if (!batch) continue;
      try {
        const loaded = await Promise.all(
          batch.map(async (candidate) => ({
            candidate,
            bytes: await loadImageBytes(candidate.image),
          })),
        );
        const usable = loaded.filter((entry) => entry.bytes);
        if (!usable.length) continue;
        const { text } = await generateText({
          model: gateway("google/gemini-3.6-flash"),
          system:
            "You screen photographs for an editorial picture desk. Be permissive: the human editor decides suitability. " +
            "primaryAdultWoman is true when one adult woman is the dominant subject of the frame — headshots, close-ups, " +
            "full-body, fashion, beauty, lifestyle, red carpet, travel, studio, social-media and casual photos all qualify, " +
            "in any orientation, styling, lighting or background. Incidental background people, partial people, reflections, " +
            "posters and photos-within-photos do NOT disqualify it. " +
            "minorOrAgeUncertain is true only if the dominant subject looks under 18 or her adulthood cannot reasonably be established. " +
            "explicitContent is true only for sexually explicit imagery or nudity. " +
            "isPhotograph is false only for corrupt/blank files, pure graphics, charts, logos or text-only images. " +
            "Return a JSON array, one object per supplied photo id, preserving each id exactly, with keys " +
            "id, isPhotograph, primaryAdultWoman, minorOrAgeUncertain, explicitContent.",
          messages: [
            {
              role: "user",
              content: usable.flatMap(({ candidate, bytes }) => [
                { type: "text" as const, text: `Photo id: ${candidate.id}` },
                { type: "image" as const, image: bytes! },
              ]),
            },
          ],
        });
        const allowedIds = new Set(batch.map((candidate) => candidate.id));
        const seen = new Set<string>();
        for (const verdict of parseVerdicts(text)) {
          if (!allowedIds.has(verdict.id) || seen.has(verdict.id)) continue;
          seen.add(verdict.id);
          unchecked.delete(verdict.id);
          const reason: PhotoRejectReason | null = !verdict.isPhotograph
            ? "image_corrupt"
            : verdict.minorOrAgeUncertain
              ? "minor_or_age_uncertain"
              : verdict.explicitContent
                ? "explicit_content"
                : !verdict.primaryAdultWoman
                  ? "no_primary_woman"
                  : null;
          if (reason) {
            rejected.add(verdict.id);
            reasons.set(verdict.id, reason);
          } else accepted.add(verdict.id);
        }
      } catch (error) {
        console.error("photo screening failed", error);
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENT_CHECKS, batches.length) }, () => worker()),
  );
  // Fail closed: anything the model never judged is blocked, not admitted.
  for (const id of unchecked) {
    rejected.add(id);
    reasons.set(id, "screen_unavailable");
  }
  return { accepted, rejected, reasons, unchecked };
}

const peopleSchema = z.object({
  id: z.string(),
  people: z.number(),
});

function parsePeople(raw: string) {
  try {
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start < 0 || end < start) return [];
    const parsed = z.array(peopleSchema).safeParse(JSON.parse(raw.slice(start, end + 1)));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/**
 * Counts the people visible in each photo. Used to keep the Glamour folder
 * strictly solo: any frame with two or more people belongs in Cinema/OTT.
 * Photos the model cannot judge are left uncounted (null) and stay put.
 */
export async function countPeopleInPhotos(
  candidates: PhotoCandidate[],
  apiKey: string | undefined,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!apiKey || candidates.length === 0) return counts;
  const gateway = createLovableAiGatewayProvider(apiKey);

  let next = 0;
  const worker = async () => {
    while (next < candidates.length) {
      const candidate = candidates[next];
      next += 1;
      if (!candidate) continue;
      try {
        const bytes = await loadImageBytes(candidate.image);
        if (!bytes) continue;
        const { text } = await generateText({
          model: gateway("google/gemini-3.6-flash"),
          system:
            "You count people in a photograph for a picture desk. Count every recognisable person in the frame, " +
            "including people beside, behind or partly visible next to the main subject. Do NOT count posters, " +
            "reflections, statues, drawings or photos-within-photos. Return a JSON array with one object per " +
            "supplied photo id, keys: id (exact), people (integer).",
          messages: [
            {
              role: "user",
              content: [
                { type: "text" as const, text: `Photo id: ${candidate.id}` },
                { type: "image" as const, image: bytes },
              ],
            },
          ],
        });
        for (const verdict of parsePeople(text)) {
          if (verdict.id !== candidate.id) continue;
          counts.set(candidate.id, Math.max(0, Math.round(verdict.people)));
        }
      } catch (error) {
        console.error("people count failed", error);
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENT_CHECKS, candidates.length) }, () => worker()),
  );
  return counts;
}
