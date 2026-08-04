import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  FORUM_CATEGORIES,
  REPLY_COLUMNS,
  THREAD_COLUMNS,
  type ForumReply,
  type ForumThread,
} from "@/lib/forum";

const CATEGORY_VALUES = FORUM_CATEGORIES.map((c) => c.value) as [string, ...string[]];
const STATUSES = ["approved", "review", "rejected"] as const;

/** Approved threads — public, safe for SSR and prerender. */
export const listThreads = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({
        category: z.string().max(40).optional(),
        city: z.string().max(60).optional(),
        limit: z.number().min(1).max(100).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<ForumThread[]> => {
    try {
      const { publicClient } = await import("@/lib/cms.server");
      let q = publicClient()
        .from("forum_threads")
        .select(THREAD_COLUMNS)
        .eq("status", "approved")
        .order("pinned", { ascending: false })
        .order("last_activity_at", { ascending: false })
        .limit(data.limit ?? 40);
      if (data.category) q = q.eq("category", data.category);
      if (data.city) q = q.eq("city", data.city);
      const { data: rows, error } = await q;
      if (error) throw error;
      return (rows ?? []) as unknown as ForumThread[];
    } catch (err) {
      console.error("listThreads failed", err);
      return [];
    }
  });

/** One approved thread with its approved replies. */
export const getThread = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(
    async ({ data }): Promise<{ thread: ForumThread | null; replies: ForumReply[] }> => {
      try {
        const { publicClient } = await import("@/lib/cms.server");
        const db = publicClient();
        const { data: thread } = await db
          .from("forum_threads")
          .select(THREAD_COLUMNS)
          .eq("id", data.id)
          .eq("status", "approved")
          .maybeSingle();
        if (!thread) return { thread: null, replies: [] };
        const { data: replies } = await db
          .from("forum_replies")
          .select(REPLY_COLUMNS)
          .eq("thread_id", data.id)
          .eq("status", "approved")
          .order("created_at", { ascending: true });
        return {
          thread: thread as unknown as ForumThread,
          replies: (replies ?? []) as unknown as ForumReply[],
        };
      } catch (err) {
        console.error("getThread failed", err);
        return { thread: null, replies: [] };
      }
    },
  );

function displayName(claims: Record<string, unknown> | undefined, fallback?: string) {
  const meta = (claims?.["user_metadata"] ?? {}) as Record<string, unknown>;
  const name =
    (fallback && fallback.trim()) ||
    (typeof meta["full_name"] === "string" ? (meta["full_name"] as string) : "") ||
    (typeof meta["name"] === "string" ? (meta["name"] as string) : "") ||
    (typeof claims?.["email"] === "string" ? (claims["email"] as string).split("@")[0]! : "");
  return (name || "Community member").slice(0, 60);
}

/** Start a thread. The AI monitor decides: live now, or into the review bucket. */
export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        category: z.enum(CATEGORY_VALUES),
        title: z.string().trim().min(8).max(140),
        body: z.string().trim().min(20).max(6000),
        city: z.string().trim().max(60).optional().or(z.literal("")),
        author_name: z.string().trim().max(60).optional().or(z.literal("")),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { moderate } = await import("@/lib/moderation.server");
    const verdict = await moderate({
      title: data.title,
      body: data.body,
      category: data.category,
    });
    const { data: row, error } = await context.supabase
      .from("forum_threads")
      .insert({
        author_id: context.userId,
        author_name: displayName(
          context.claims as unknown as Record<string, unknown>,
          data.author_name,
        ),
        category: data.category,
        title: data.title,
        body: data.body,
        city: data.city && data.city.length > 0 ? data.city : null,
        status: verdict.action === "approve" ? "approved" : "review",
        ai_action: verdict.action,
        ai_reason: verdict.reason,
        ai_labels: verdict.labels,
        ai_score: verdict.score,
      })
      .select("id, status")
      .single();
    if (error) {
      console.error("createThread failed", error);
      throw new Error("We could not post that right now. Please try again.");
    }
    return { id: row.id as string, status: row.status as string, reason: verdict.reason };
  });

/** Reply to a thread, through the same AI monitor. */
export const createReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        thread_id: z.string().uuid(),
        body: z.string().trim().min(2).max(4000),
        author_name: z.string().trim().max(60).optional().or(z.literal("")),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { moderate } = await import("@/lib/moderation.server");
    const verdict = await moderate({ body: data.body });
    const { error } = await context.supabase.from("forum_replies").insert({
      thread_id: data.thread_id,
      author_id: context.userId,
      author_name: displayName(
        context.claims as unknown as Record<string, unknown>,
        data.author_name,
      ),
      body: data.body,
      status: verdict.action === "approve" ? "approved" : "review",
      ai_action: verdict.action,
      ai_reason: verdict.reason,
      ai_labels: verdict.labels,
      ai_score: verdict.score,
    });
    if (error) {
      console.error("createReply failed", error);
      throw new Error("We could not post that reply. Please try again.");
    }
    return { status: verdict.action === "approve" ? "approved" : "review", reason: verdict.reason };
  });

/** Everything in the forum moderation buckets, for editors. */
export const listForumQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ status: z.enum(STATUSES).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertStaff } = await import("@/lib/cms.server");
    await assertStaff(context.supabase as never, context.userId);
    const status = data.status ?? "review";
    const [threads, replies] = await Promise.all([
      context.supabase
        .from("forum_threads")
        .select(THREAD_COLUMNS)
        .eq("status", status)
        .order("created_at", { ascending: false })
        .limit(100),
      context.supabase
        .from("forum_replies")
        .select(REPLY_COLUMNS)
        .eq("status", status)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (threads.error) throw threads.error;
    if (replies.error) throw replies.error;
    return {
      threads: (threads.data ?? []) as unknown as ForumThread[],
      replies: (replies.data ?? []) as unknown as ForumReply[],
    };
  });

/** Move forum posts between the approved and review buckets. */
export const moderateForum = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        table: z.enum(["threads", "replies"]),
        ids: z.array(z.string().uuid()).min(1).max(100),
        status: z.enum(STATUSES),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertStaff } = await import("@/lib/cms.server");
    await assertStaff(context.supabase as never, context.userId);
    const { error } = await context.supabase
      .from(data.table === "threads" ? "forum_threads" : "forum_replies")
      .update({
        status: data.status,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .in("id", data.ids);
    if (error) throw error;
    return { ok: true, count: data.ids.length };
  });