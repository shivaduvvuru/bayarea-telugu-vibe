/**
 * City News headline pick.
 *
 * Editors can pin one published story as the City News headline. When nothing
 * is pinned (or the pinned story was removed) the newest published city story
 * is used instead, so the hero is never empty.
 */
import { publicClient } from "./cms.server";
import { cmsPost, cmsPosts } from "./cms-articles.server";
import type { Article } from "./content";

export const HEADLINE_SLOT = "city-news";

export type Headline = {
  article: Article;
  /** Optional banner label, e.g. "Breaking News". */
  label: string | null;
  /** True when an editor pinned this story. */
  pinned: boolean;
  updatedAt: string | null;
};

type PickRow = { content_id: string | null; label: string | null; updated_at: string | null };

type ReadClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{ data: PickRow | null }>;
      };
    };
  };
};

type WriteClient = {
  from: (table: string) => {
    upsert: (row: unknown, opts: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
  };
};

export async function readHeadlinePick(): Promise<PickRow | null> {
  try {
    const { data } = await (publicClient() as unknown as ReadClient)
      .from("headline_picks")
      .select("content_id, label, updated_at")
      .eq("slot", HEADLINE_SLOT)
      .maybeSingle();
    return data ?? null;
  } catch (err) {
    console.error("headline pick read failed", err);
    return null;
  }
}

export async function readHeadline(): Promise<Headline | null> {
  const pick = await readHeadlinePick();
  if (pick?.content_id) {
    const article = await cmsPost(`c-${pick.content_id}`);
    if (article) {
      return { article, label: pick.label, pinned: true, updatedAt: pick.updated_at };
    }
  }
  // Same arguments the City News page itself uses, so this shares the cached
  // feed read instead of recomputing the whole desk for one headline.
  const [newest] = await cmsPosts("city-news", 24);
  return newest ? { article: newest, label: null, pinned: false, updatedAt: null } : null;
}

/** Pins a story (or clears the pin when contentId is null). One slot only. */
export async function writeHeadline(contentId: string | null, label: string | null) {
  const { admin } = await import("./cms.server");
  const db = (await admin()) as unknown as WriteClient;
  const { error } = await db.from("headline_picks").upsert(
    {
      slot: HEADLINE_SLOT,
      content_id: contentId,
      label: label && label.trim() ? label.trim().slice(0, 40) : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "slot" },
  );
  if (error) throw new Error(error.message);
  return { ok: true as const };
}
