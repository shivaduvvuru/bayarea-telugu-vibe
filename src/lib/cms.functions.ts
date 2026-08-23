import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PUBLIC_COLUMNS, type ContentItem } from "@/lib/cms";
import { dedupeKey } from "@/lib/dedupe";

const KINDS = ["news", "event", "announcement", "photo", "classified", "ad"] as const;
const PLACEMENTS = ["auto", "home_lead", "home_rail", "section", "hidden"] as const;
const STATUSES = ["published", "pending", "removed", "duplicate"] as const;

/** Published community items — public, safe for SSR and prerender. */
export const listCommunityItems = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({ kind: z.enum(KINDS).optional(), limit: z.number().min(1).max(200).optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { readPublished } = await import("@/lib/cms.server");
    try {
      return await readPublished(data);
    } catch (err) {
      console.error("listCommunityItems failed", err);
      return [] as ContentItem[];
    }
  });

const submission = z.object({
  kind: z.enum(KINDS),
  title: z.string().trim().min(4).max(160),
  summary: z.string().trim().max(400).optional().or(z.literal("")),
  body: z.string().trim().max(6000).optional().or(z.literal("")),
  link_url: z.string().trim().url().max(500).optional().or(z.literal("")),
  image_url: z.string().trim().max(500).optional().or(z.literal("")),
  city: z.string().trim().max(60).optional().or(z.literal("")),
  venue: z.string().trim().max(160).optional().or(z.literal("")),
  event_start: z.string().trim().max(40).optional().or(z.literal("")),
  submitter_name: z.string().trim().min(2).max(80),
  submitter_email: z.string().trim().email().max(160),
});

/** Public submission — always lands in the pending queue for review. */
export const submitContent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => submission.parse(input))
  .handler(async ({ data }) => {
    const { admin } = await import("@/lib/cms.server");
    const db = await admin();
    const blank = (v?: string) => (v && v.length > 0 ? v : null);
    const key = dedupeKey(data.title);
    // Flag submissions that repeat something already on the site.
    const { data: clash } = key
      ? await db
          .from("content_items")
          .select("id")
          .eq("dedupe_key", key)
          .neq("status", "duplicate")
          .limit(1)
          .maybeSingle()
      : { data: null };
    const { data: row, error } = await db
      .from("content_items")
      .insert({
      source: "submission",
      status: clash ? "duplicate" : "pending",
      duplicate_of: clash?.id ?? null,
      dedupe_key: key || null,
      placement: "auto",
      kind: data.kind,
      title: data.title,
      summary: blank(data.summary),
      body: blank(data.body),
      link_url: blank(data.link_url),
      image_url: blank(data.image_url),
      city: blank(data.city),
      venue: blank(data.venue),
      event_start: blank(data.event_start) ? new Date(data.event_start!).toISOString() : null,
      })
      .select("id")
      .single();
    if (error) {
      console.error("submitContent failed", error);
      throw new Error("We could not save your submission. Please try again.");
    }
    // Submitter contact details are stored in a private, staff-only table.
    const { error: contactError } = await db.from("content_item_contacts").insert({
      content_item_id: row.id,
      submitter_name: data.submitter_name,
      submitter_email: data.submitter_email,
    });
    if (contactError) console.error("submitContent contact insert failed", contactError);
    return { ok: true, duplicate: Boolean(clash) };
  });

/** Uploads a submission photo (base64) and returns its public media path. */
export const uploadSubmissionPhoto = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        filename: z.string().trim().max(120),
        contentType: z.string().regex(/^image\/(png|jpeg|jpg|webp|gif)$/),
        dataBase64: z.string().max(8_000_000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const bytes = Buffer.from(data.dataBase64, "base64");
    if (bytes.byteLength > 5_000_000) throw new Error("Image must be under 5 MB.");
    const { admin } = await import("@/lib/cms.server");
    const db = await admin();
    const ext = (data.filename.split(".").pop() ?? "jpg").toLowerCase().slice(0, 5);
    const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
    const { error } = await db.storage
      .from("submissions")
      .upload(path, bytes, { contentType: data.contentType, upsert: false });
    if (error) {
      console.error("uploadSubmissionPhoto failed", error);
      throw new Error("Upload failed. Please try a smaller image.");
    }
    return { path: `/api/public/media/${path}` };
  });

/** Everything an editor may review, newest first. */
export const listReviewQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        status: z.enum(STATUSES).optional(),
        source: z.string().max(30).optional(),
        limit: z.number().min(1).max(200).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertStaff } = await import("@/lib/cms.server");
    await assertStaff(context.supabase as never, context.userId);
    let q = context.supabase
      .from("content_items")
      .select(PUBLIC_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (data.status) q = q.eq("status", data.status);
    if (data.source) q = q.eq("source", data.source);
    const { data: rows, error } = await q;
    if (error) throw error;
    return (rows ?? []) as unknown as ContentItem[];
  });

/** Approve, remove or re-publish items, and set where they appear. */
export const reviewItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(200),
        status: z.enum(STATUSES).optional(),
        placement: z.enum(PLACEMENTS).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertStaff } = await import("@/lib/cms.server");
    await assertStaff(context.supabase as never, context.userId);
    const now = new Date().toISOString();
    const patch = {
      reviewed_by: context.userId,
      reviewed_at: now,
      ...(data.status ? { status: data.status } : {}),
      ...(data.status === "published" ? { published_at: now } : {}),
      ...(data.placement ? { placement: data.placement } : {}),
    };
    const { error } = await context.supabase
      .from("content_items")
      .update(patch)
      .in("id", data.ids);
    if (error) throw error;
    return { ok: true, count: data.ids.length };
  });

/** Editor-created content, published straight away. */
export const createItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        kind: z.enum(KINDS),
        placement: z.enum(PLACEMENTS).default("auto"),
        title: z.string().trim().min(4).max(160),
        summary: z.string().trim().max(400).optional(),
        body: z.string().trim().max(20000).optional(),
        image_url: z.string().trim().max(500).optional(),
        link_url: z.string().trim().max(500).optional(),
        city: z.string().trim().max(60).optional(),
        category: z.string().trim().max(60).optional(),
        venue: z.string().trim().max(160).optional(),
        event_start: z.string().trim().max(40).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertStaff } = await import("@/lib/cms.server");
    await assertStaff(context.supabase as never, context.userId);
    const blank = (v?: string) => (v && v.length > 0 ? v : null);
    const { classifyForPublish } = await import("@/lib/classify-at-publish.server");
    const { error } = await context.supabase.from("content_items").insert({
      ...classifyForPublish({
        title: data.title,
        summary: blank(data.summary),
        link_url: blank(data.link_url),
        city: blank(data.city),
        category: blank(data.category),
      }),
      source: "admin",
      status: "published",
      dedupe_key: dedupeKey(data.title) || null,
      published_at: new Date().toISOString(),
      kind: data.kind,
      placement: data.placement,
      title: data.title,
      summary: blank(data.summary),
      body: blank(data.body),
      image_url: blank(data.image_url),
      link_url: blank(data.link_url),
      city: blank(data.city),
      category: blank(data.category),
      venue: blank(data.venue),
      event_start: blank(data.event_start) ? new Date(data.event_start!).toISOString() : null,
    });
    if (error) throw error;
    return { ok: true };
  });

/** Roles of the signed-in user, plus a one-time first-admin claim. */
export const myAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (data ?? []).map((r) => r.role as string);
    return { userId: context.userId, roles, isStaff: roles.length > 0 };
  });

/** The very first signed-in user can claim admin; afterwards this is closed. */
export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin } = await import("@/lib/cms.server");
    const db = await admin();
    const { count } = await db
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("An administrator already exists.");
    const { error } = await db
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (error) throw error;
    return { ok: true };
  });