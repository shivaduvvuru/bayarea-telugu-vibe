import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DuplicateRow = {
  id: string;
  title: string | null;
  norm_title: string | null;
  canonical_url: string | null;
  link_url: string | null;
  source: string | null;
  created_at: string;
  updated_at: string | null;
  duplicate_of: string | null;
  original: {
    id: string;
    title: string | null;
    norm_title: string | null;
    canonical_url: string | null;
    source: string | null;
    created_at: string;
  } | null;
};

/**
 * Staff-only audit of what the duplicate guard collapsed: every row marked
 * `duplicate`, paired with the original it points at, so the backfill can be
 * reviewed by eye.
 */
export const listDuplicates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { search?: string; limit?: number; offset?: number } | undefined) => ({
    search: input?.search ? String(input.search).slice(0, 120) : "",
    limit: Math.min(Math.max(Number(input?.limit ?? 50), 1), 200),
    offset: Math.max(Number(input?.offset ?? 0), 0),
  }))
  .handler(async ({ context, data }) => {
    const { assertStaff } = await import("@/lib/cms.server");
    await assertStaff(context.supabase, context.userId);
    const db = context.supabase;

    let q = db
      .from("content_items")
      .select(
        "id, title, norm_title, canonical_url, link_url, source, created_at, updated_at, duplicate_of",
        { count: "exact" },
      )
      .eq("status", "duplicate")
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (data.search) {
      const like = `%${data.search}%`;
      q = q.or(`title.ilike.${like},canonical_url.ilike.${like},source.ilike.${like}`);
    }
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    const dupes = (rows ?? []) as Omit<DuplicateRow, "original">[];

    const originalIds = [...new Set(dupes.map((r) => r.duplicate_of).filter(Boolean))] as string[];
    const originals = new Map<string, NonNullable<DuplicateRow["original"]>>();
    if (originalIds.length > 0) {
      const { data: orig } = await db
        .from("content_items")
        .select("id, title, norm_title, canonical_url, source, created_at")
        .in("id", originalIds);
      for (const o of orig ?? []) originals.set(o.id, o as NonNullable<DuplicateRow["original"]>);
    }

    const items: DuplicateRow[] = dupes.map((r) => ({
      ...r,
      original: (r.duplicate_of && originals.get(r.duplicate_of)) || null,
    }));

    // Rejects never reach content_items, so they are counted separately.
    const { count: rejectCount } = await db
      .from("rejected_duplicates")
      .select("id", { count: "exact", head: true });

    return {
      items,
      total: count ?? items.length,
      rejectedLogged: rejectCount ?? 0,
      limit: data.limit,
      offset: data.offset,
    };
  });
