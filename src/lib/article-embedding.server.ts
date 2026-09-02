/**
 * Article embeddings for semantic de-duplication.
 *
 * Embeddings are an *addition* to the existing canonical URL / strict-title /
 * body-similarity guard, never a replacement: if the gateway is unavailable or
 * over budget we return null and the caller falls back to the cheap checks, so
 * publishing never blocks on an AI call.
 */

const EMBED_MODEL = "google/text-embedding-004";
const DIMENSIONS = 768;

/** Cosine-similarity threshold above which two stories are the same story. */
export const SEMANTIC_DUPLICATE_THRESHOLD = 0.92;

/** Title + summary is enough signal for "same story, different publisher". */
export function embeddingInput(row: {
  title?: string | null;
  summary?: string | null;
}): string {
  return [row.title, row.summary].filter(Boolean).join("\n").slice(0, 2_000).trim();
}

/**
 * One embedding, or null when embeddings are unavailable. Never throws: a
 * failed embedding must degrade to "no semantic signal", not a failed publish.
 */
export async function embedText(text: string): Promise<number[] | null> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey || !text) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({ model: EMBED_MODEL, input: text }),
    });
    if (!res.ok) {
      console.warn(`[embedding] skipped: HTTP ${res.status}`);
      return null;
    }
    const json = (await res.json()) as { data?: { embedding?: number[] }[] };
    const vector = json.data?.[0]?.embedding;
    if (!Array.isArray(vector) || vector.length !== DIMENSIONS) return null;
    return vector;
  } catch (e) {
    console.warn(`[embedding] skipped: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

type MatchRow = { id: string; title: string; similarity: number };

/**
 * Nearest recent article for a vector, or null. Uses the `match_articles`
 * matcher, which only considers published rows from the last 48 hours.
 */
export async function nearestArticle(
  db: {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  },
  embedding: number[],
  threshold = SEMANTIC_DUPLICATE_THRESHOLD,
): Promise<MatchRow | null> {
  const { data, error } = await db.rpc("match_articles", {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: 1,
  });
  if (error) {
    console.warn(`[embedding] match skipped: ${error.message}`);
    return null;
  }
  const rows = (data ?? []) as MatchRow[];
  return rows[0] ?? null;
}
