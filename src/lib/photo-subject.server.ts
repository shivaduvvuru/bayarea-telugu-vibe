import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

type PhotoCandidate = {
  id: string;
  image: string;
};

export type PhotoVerification = {
  accepted: Set<string>;
  rejected: Set<string>;
  unchecked: Set<string>;
};

const BATCH_SIZE = 1;

const verdictSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      realPhotograph: z.boolean(),
      adultWomen: z.number().int().min(0),
      otherPeople: z.number().int().min(0),
      uncertain: z.boolean(),
    }),
  ),
});

/**
 * Looks at the actual artwork instead of trusting a headline. A picture passes
 * only when it visibly contains exactly one adult woman and no other person.
 * Unreadable images and uncertain model answers fail closed.
 */
export async function verifySoloWomanPhotos(
  candidates: PhotoCandidate[],
  apiKey: string | undefined,
): Promise<PhotoVerification> {
  const accepted = new Set<string>();
  const rejected = new Set<string>();
  const unchecked = new Set(candidates.map((candidate) => candidate.id));
  if (!apiKey) return { accepted, rejected, unchecked };

  const gateway = createLovableAiGatewayProvider(apiKey);
  const batches: PhotoCandidate[][] = [];
  for (let offset = 0; offset < candidates.length; offset += BATCH_SIZE) {
    batches.push(candidates.slice(offset, offset + BATCH_SIZE));
  }
  await Promise.all(batches.map(async (batch) => {
    try {
      const { output } = await generateText({
        model: gateway("google/gemini-3.6-flash"),
        output: Output.object({ schema: verdictSchema }),
        system:
          "You are a strict photo-subject validator. Inspect every supplied image independently. " +
          "Count every visible person, including small, background, cropped, reflected, partially hidden, and inset people. " +
          "adultWomen is the count of visible adult women. otherPeople is every visible person who is not that one adult woman. " +
          "Set realPhotograph false for collages, split images, posters, illustrations, statues, objects, or landscapes. " +
          "Set uncertain true if the image is unreadable or any person/count cannot be determined confidently. " +
          "Clothing and glamour level do not affect the count. " +
          "Return one result for every supplied photo id, preserving each id exactly.",
        messages: [
          {
            role: "user",
            content: batch.flatMap((candidate) => [
              { type: "text" as const, text: `Photo id: ${candidate.id}` },
              { type: "image" as const, image: new URL(candidate.image) },
            ]),
          },
        ],
      });
      const allowedIds = new Set(batch.map((candidate) => candidate.id));
      const seen = new Set<string>();
      for (const verdict of output.results) {
        if (!allowedIds.has(verdict.id) || seen.has(verdict.id)) continue;
        seen.add(verdict.id);
        unchecked.delete(verdict.id);
        if (
          verdict.realPhotograph &&
          verdict.adultWomen === 1 &&
          verdict.otherPeople === 0 &&
          !verdict.uncertain
        ) {
          accepted.add(verdict.id);
        }
        else rejected.add(verdict.id);
      }
    } catch (error) {
      console.error("photo subject validation failed", error);
    }
  }));
  return { accepted, rejected, unchecked };
}