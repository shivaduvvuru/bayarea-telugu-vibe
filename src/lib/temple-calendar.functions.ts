import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { TempleEventDTO } from "@/lib/temple-calendar";

export type TempleSourceDTO = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  region: string | null;
  website: string | null;
  eventsUrl: string | null;
  rssUrl: string | null;
  icsUrl: string | null;
  gcalUrl: string | null;
  status: string;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  active: boolean;
  autoImport: boolean;
  notes: string | null;
};

const EVENT_COLUMNS =
  "id,temple_slug,temple_name,city,region,title,description,starts_at,ends_at,all_day,deities,event_type,event_group,level,image_url,register_url,source_url,recurrence,cost_type,language,organizer,status,last_verified_at";

/* eslint-disable @typescript-eslint/no-explicit-any */
function toEvent(r: any): TempleEventDTO {
  return {
    id: r.id,
    templeSlug: r.temple_slug ?? null,
    templeName: r.temple_name,
    city: r.city ?? null,
    region: r.region ?? null,
    title: r.title,
    description: r.description ?? null,
    startsAt: r.starts_at,
    endsAt: r.ends_at ?? null,
    allDay: Boolean(r.all_day),
    deities: r.deities ?? [],
    eventType: r.event_type ?? "Program",
    eventGroup: r.event_group ?? "puja",
    level: r.level ?? "routine",
    imageUrl: r.image_url ?? null,
    registerUrl: r.register_url ?? null,
    sourceUrl: r.source_url ?? null,
    recurrence: r.recurrence ?? null,
    costType: r.cost_type ?? null,
    language: r.language ?? null,
    organizer: r.organizer ?? null,
    status: r.status ?? "published",
    lastVerifiedAt: r.last_verified_at,
  };
}

async function publicDb() {
  const { publicClient } = await import("@/lib/cms.server");
  return publicClient() as unknown as { from: (t: string) => any };
}

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as { from: (t: string) => any };
}

/** Public, prerender-safe read of upcoming published temple programs. */
export const listTempleEvents = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({
        templeSlug: z.string().max(120).optional(),
        limit: z.number().min(1).max(500).optional(),
        featuredOnly: z.boolean().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<TempleEventDTO[]> => {
    try {
      const db = await publicDb();
      let q = db
        .from("temple_events")
        .select(EVENT_COLUMNS)
        .eq("status", "published")
        .gte("starts_at", new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
        .order("starts_at", { ascending: true })
        .limit(data.limit ?? 300);
      if (data.templeSlug) q = q.eq("temple_slug", data.templeSlug);
      if (data.featuredOnly) q = q.eq("level", "featured");
      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);
      return (rows ?? []).map(toEvent);
    } catch (err) {
      console.error("listTempleEvents failed", err);
      return [];
    }
  });

/** Public list of temples for the Temple Calendar filter dropdowns. */
export const listTempleSources = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ slug: string; name: string; city: string | null; region: string | null }[]> => {
    try {
      const db = await publicDb();
      const { data, error } = await db
        .from("temple_sources")
        .select("slug,name,city,region")
        .eq("active", true)
        .order("name", { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    } catch (err) {
      console.error("listTempleSources failed", err);
      return [];
    }
  },
);

/* ------------------------------ desk-gated ------------------------------- */

async function requireDesk(deskToken?: string) {
  const { deskUnlocked } = await import("@/lib/desk-session.server");
  if (await deskUnlocked()) return;
  if (deskToken) {
    const { verifyDeskToken } = await import("@/lib/desk-session.server");
    if (verifyDeskToken(deskToken)) return;
  }
  throw new Error("Editorial desk sign-in required");
}

const gate = z.object({ deskToken: z.string().max(400).optional() });

/** Temple source registry with fetch-health for the admin screen. */
export const adminListTempleSources = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => gate.parse(input ?? {}))
  .handler(async ({ data }): Promise<TempleSourceDTO[]> => {
    await requireDesk(data.deskToken);
    const db = await adminDb();
    const { data: rows, error } = await db
      .from("temple_sources")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      city: r.city,
      region: r.region,
      website: r.website,
      eventsUrl: r.events_url,
      rssUrl: r.rss_url,
      icsUrl: r.ics_url,
      gcalUrl: r.gcal_url,
      status: r.status,
      lastCheckedAt: r.last_checked_at,
      lastSuccessAt: r.last_success_at,
      lastError: r.last_error,
      active: r.active,
      autoImport: r.auto_import,
      notes: r.notes,
    }));
  });

/** Create or update a temple source record. */
export const saveTempleSource = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    gate
      .extend({
        slug: z.string().trim().min(3).max(120),
        name: z.string().trim().min(3).max(160),
        city: z.string().trim().max(80).optional(),
        region: z.string().trim().max(40).optional(),
        website: z.string().trim().url().max(400).optional().or(z.literal("")),
        eventsUrl: z.string().trim().url().max(400).optional().or(z.literal("")),
        rssUrl: z.string().trim().url().max(400).optional().or(z.literal("")),
        icsUrl: z.string().trim().url().max(400).optional().or(z.literal("")),
        gcalUrl: z.string().trim().url().max(400).optional().or(z.literal("")),
        notes: z.string().trim().max(500).optional(),
        active: z.boolean().optional(),
        autoImport: z.boolean().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    await requireDesk(data.deskToken);
    const db = await adminDb();
    const blank = (v?: string) => (v && v.length > 0 ? v : null);
    const { error } = await db.from("temple_sources").upsert(
      {
        slug: data.slug,
        name: data.name,
        city: blank(data.city),
        region: blank(data.region),
        website: blank(data.website),
        events_url: blank(data.eventsUrl),
        rss_url: blank(data.rssUrl),
        ics_url: blank(data.icsUrl),
        gcal_url: blank(data.gcalUrl),
        notes: blank(data.notes),
        ...(data.active === undefined ? {} : { active: data.active }),
        ...(data.autoImport === undefined ? {} : { auto_import: data.autoImport }),
      },
      { onConflict: "slug" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Programs awaiting editorial review. */
export const listTempleReviewQueue = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => gate.parse(input ?? {}))
  .handler(async ({ data }): Promise<TempleEventDTO[]> => {
    await requireDesk(data.deskToken);
    const db = await adminDb();
    const { data: rows, error } = await db
      .from("temple_events")
      .select(EVENT_COLUMNS)
      .eq("status", "needs_review")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    return (rows ?? []).map(toEvent);
  });

/** Approve, reject, or flag importance for imported programs. */
export const reviewTempleEvents = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    gate
      .extend({
        ids: z.array(z.string().uuid()).min(1).max(200),
        action: z.enum(["publish", "reject", "feature", "routine"]),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    await requireDesk(data.deskToken);
    const db = await adminDb();
    const now = new Date().toISOString();
    const patch: Record<string, unknown> =
      data.action === "publish"
        ? { status: "published", last_verified_at: now }
        : data.action === "reject"
          ? { status: "rejected" }
          : data.action === "feature"
            ? { level: "featured", featured: true, status: "published", last_verified_at: now }
            : { level: "routine", featured: false };
    const { error } = await db.from("temple_events").update(patch).in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true as const, count: data.ids.length };
  });

/** Manual "Refresh now" for one temple or the whole registry. */
export const refreshTempleCalendar = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    gate.extend({ slug: z.string().max(120).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    await requireDesk(data.deskToken);
    const { runTempleCalendarIngest } = await import("@/lib/temple-calendar.server");
    return runTempleCalendarIngest({
      budgetMs: data.slug ? 20_000 : 60_000,
      ...(data.slug ? { slug: data.slug } : {}),
    });
  });
