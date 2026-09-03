import {
  embedText,
  embeddingInput,
  nearestArticle,
  SEMANTIC_DUPLICATE_THRESHOLD,
} from "@/lib/article-embedding.server";

/**
 * Mirrors freshly published newsroom rows into the read-optimised `articles`
 * table that the Daily Smart Digest reads.
 *
 * Reads stay small indexed lookups because the desk, city, source, bullets and
 * importance are all resolved once here at publish time. Writes are idempotent
 * on `content_item_id`, so re-running a publish pass cannot create twins.
 */

export type MirrorSource = {
  id: string;
  title?: string | null;
  summary?: string | null;
  why_it_matters?: string | null;
  what_to_do?: string | null;
  resolved_category?: string | null;
  is_local?: boolean | null;
  city?: string | null;
  source?: string | null;
  source_names?: string[] | null;
  link_url?: string | null;
  source_ref?: string | null;
  image_url?: string | null;
  priority_score?: number | null;
  published_at?: string | null;
  created_at?: string | null;
  kind?: string | null;
  status?: string | null;
  placement?: string | null;
};

export type MirrorResult = { mirrored: number; semanticDuplicates: number };

/** Same mapping the initial backfill used, so old and new rows file together. */
export function deskOf(row: MirrorSource): string {
  const category = row.resolved_category ?? "";
  if (category === "cinema" || category === "gallery" || category === "micro-drama")
    return "cinema-glamour";
  if (row.is_local) return "bay-area";
  if (category === "india-telangana" || category === "india-andhra" || category === "india-news")
    return "telangana-andhra";
  // Not local, not India, not film: national/world/business copy files under its
  // own desk instead of padding the Bay Area column.
  return "national";
}

/** Three short takeaways from the fields the newsroom already writes. */
export function bulletsOf(row: MirrorSource): string[] {
  return [row.summary, row.why_it_matters, row.what_to_do]
    .map((b) => (typeof b === "string" ? b.trim() : ""))
    .filter(Boolean)
    .slice(0, 3);
}

export function toArticleRow(row: MirrorSource, embedding: number[] | null) {
  return {
    content_item_id: row.id,
    title: row.title ?? "",
    summary: row.summary ?? null,
    summary_bullets: bulletsOf(row),
    desk: deskOf(row),
    city: row.city ?? null,
    source_name: row.source_names?.[0] ?? row.source ?? null,
    source_url: row.link_url ?? row.source_ref ?? null,
    image_url: row.image_url ?? null,
    importance_score: row.priority_score ?? 0,
    status: "published",
    published_at: row.published_at ?? row.created_at ?? new Date().toISOString(),
    embedding: embedding ? (embedding as unknown as never) : null,
  };
}

/** Only genuinely reader-facing published news reaches the digest. */
function eligible(row: MirrorSource): boolean {
  return (
    !!row.title &&
    (row.status ?? "published") === "published" &&
    (row.placement ?? "auto") !== "hidden" &&
    (row.kind ?? "news") === "news"
  );
}

/**
 * Upserts rows into `articles`, dropping anything an embedding says is the same
 * story as something published in the last 48 hours. When embeddings are
 * unavailable the semantic step is skipped and the row still mirrors — the
 * upstream canonical URL / title / body guard has already run by this point.
 */
export async function mirrorToArticles(
  db: {
    from: (table: string) => any;
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: any }>;
  },
  rows: MirrorSource[],
): Promise<MirrorResult> {
  const candidates = rows.filter(eligible);
  if (!candidates.length) return { mirrored: 0, semanticDuplicates: 0 };

  const payload: ReturnType<typeof toArticleRow>[] = [];
  let semanticDuplicates = 0;

  for (const row of candidates) {
    const embedding = await embedText(embeddingInput(row));
    if (embedding) {
      const hit = await nearestArticle(db, embedding, SEMANTIC_DUPLICATE_THRESHOLD);
      if (hit) {
        console.log(
          `[dedupe] semantic match similarity=${hit.similarity.toFixed(3)} original=${hit.id} ` +
            `title="${row.title}"`,
        );
        semanticDuplicates += 1;
        continue;
      }
    }
    payload.push(toArticleRow(row, embedding));
  }

  if (!payload.length) return { mirrored: 0, semanticDuplicates };

  const { error } = await db
    .from("articles")
    .upsert(payload, { onConflict: "content_item_id", ignoreDuplicates: false });
  if (error) {
    console.warn(`[digest] mirror skipped: ${error.message}`);
    return { mirrored: 0, semanticDuplicates };
  }
  return { mirrored: payload.length, semanticDuplicates };
}
