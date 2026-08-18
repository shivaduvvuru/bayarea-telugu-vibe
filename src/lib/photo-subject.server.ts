import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

type PhotoCandidate = {
  id: string;
  image: string;
};

type PhotoVerdict = {
  id: string;
  soloWoman: boolean;
};

const BATCH_SIZE = 6;

function parseVerdicts(raw: string): PhotoVerdict[] {
  try {
    const jsonText = raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}";
    const parsed = JSON.parse(jsonText) as { results?: unknown[] };
    return (parsed.results ?? []).flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const value = entry as Record<string, unknown>;
      if (typeof value["id"] !== "string" || typeof value["soloWoman"] !== "boolean") {
        return [];
      }
      return [{ id: value["id"], soloWoman: value["soloWoman"] }];
    });
  } catch {
    return [];
  }
}

/**
 * Looks at the actual artwork instead of trusting a headline. A picture passes
 * only when it visibly contains exactly one adult woman and no other person.
 * Unreadable images and uncertain model answers fail closed.
 */
export async function verifySoloWomanPhotos(
  candidates: PhotoCandidate[],
  apiKey: string | undefined,
): Promise<Set<string>> {
  const accepted = new Set<string>();
  if (!apiKey) return accepted;

  const gateway = createLovableAiGatewayProvider(apiKey);
  for (let offset = 0; offset < candidates.length; offset += BATCH_SIZE) {
    const batch = candidates.slice(offset, offset + BATCH_SIZE);
    try {
      const { text } = await Promise.race([
        generateText({
          model: gateway("google/gemini-3.6-flash"),
          system:
            "You are a strict photo-subject validator. Inspect each supplied image. " +
            "soloWoman is true only for a real photograph visibly containing exactly one adult woman and zero other people. " +
            "Return false for any man, child, second person, crowd, couple, group, collage, split image, poster, illustration, " +
            "unclear/hidden person, or image you cannot inspect. Clothing or glamour level does not affect this decision. " +
            'Reply with JSON only: {"results":[{"id":"exact id","soloWoman":true}]}. Include every id.',
          messages: [
            {
              role: "user",
              content: batch.flatMap((candidate) => [
                { type: "text" as const, text: `Photo id: ${candidate.id}` },
                { type: "image" as const, image: new URL(candidate.image) },
              ]),
            },
          ],
        }),
        new Promise<{ text: string }>((resolve) =>
          setTimeout(() => resolve({ text: "" }), 18_000),
        ),
      ]);
      const allowedIds = new Set(batch.map((candidate) => candidate.id));
      for (const verdict of parseVerdicts(text)) {
        if (verdict.soloWoman && allowedIds.has(verdict.id)) accepted.add(verdict.id);
      }
    } catch (error) {
      console.error("photo subject validation failed", error);
    }
  }
  return accepted;
}