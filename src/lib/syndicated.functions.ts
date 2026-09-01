import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SyndicatedStory = {
  id: string;
  title: string;
  excerpt: string | null;
  canonical_url: string;
  image_url: string | null;
  published_at: string | null;
  source_category: string | null;
  source_name: string;
  status: string;
};

const STORY_COLUMNS =
  "id,title,excerpt,canonical_url,image_url,published_at,source_category,source_name,status";

/** Public, published New India Abroad stories for the City News sub-block. */
export const listSyndicatedStories = createServerFn({ method: "GET" }).handler(
  async (): Promise<SyndicatedStory[]> => {
    const { publicClient } = await import("@/lib/cms.server");
    const { data, error } = await publicClient()
      .from("syndicated_stories")
      .select(STORY_COLUMNS)
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(6);
    if (error) {
      console.error("listSyndicatedStories failed", error.message);
      return [];
    }
    return (data ?? []) as SyndicatedStory[];
  },
);

/** Staff list for the operational syndication screen. */
export const listSyndicationAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ stories: SyndicatedStory[]; runs: SyndicationRun[] }> => {
    const { assertStaff, admin } = await import("@/lib/cms.server");
    await assertStaff(context.supabase, context.userId);
    const db = await admin();
    const [{ data: stories }, { data: runs }] = await Promise.all([
      db.from("syndicated_stories").select(`${STORY_COLUMNS},fetched_at,updated_at`).order("published_at", { ascending: false }).limit(100),
      db.from("syndication_runs").select("id,trigger,fetched_count,new_count,error,elapsed_ms,finished_at").order("finished_at", { ascending: false }).limit(20),
    ]);
    return {
      stories: (stories ?? []) as SyndicatedStory[],
      runs: (runs ?? []) as SyndicationRun[],
    };
  });

export type SyndicationRun = {
  id: string;
  trigger: string;
  fetched_count: number | null;
  new_count: number | null;
  error: string | null;
  elapsed_ms: number | null;
  finished_at: string;
};

export const updateSyndicatedStory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["published", "hidden"]),
      excerpt: z.string().trim().max(500).nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { assertStaff, admin } = await import("@/lib/cms.server");
    await assertStaff(context.supabase, context.userId);
    const db = await admin();
    const patch: { status: string; excerpt?: string | null } = { status: data.status };
    if (data.excerpt !== undefined) patch.excerpt = data.excerpt || null;
    const { error } = await db.from("syndicated_stories").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const runSyndicationNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertStaff } = await import("@/lib/cms.server");
    await assertStaff(context.supabase, context.userId);
    const { syndicateNewIndiaAbroad } = await import("@/lib/syndicate-nia.server");
    return syndicateNewIndiaAbroad("manual");
  });
