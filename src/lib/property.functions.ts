import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Property, PropertyCampaign } from "@/lib/property";

const slug = z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/);

/** Campaign plus its projects — one round trip for the landing page. */
export const getCampaign = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug }).parse(input))
  .handler(async ({ data }): Promise<{ campaign: PropertyCampaign | null; properties: Property[] }> => {
    const { readCampaign, readProperties } = await import("@/lib/property.server");
    try {
      const campaign = await readCampaign(data.slug);
      if (!campaign) return { campaign: null, properties: [] };
      return { campaign, properties: await readProperties(data.slug) };
    } catch (err) {
      console.error("getCampaign failed", err);
      return { campaign: null, properties: [] };
    }
  });

/** The campaign the homepage module promotes (null when none is scheduled). */
export const getFeaturedCampaign = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ campaign: PropertyCampaign | null; properties: Property[] }> => {
    const { readFeaturedCampaign, readProperties } = await import("@/lib/property.server");
    try {
      const campaign = await readFeaturedCampaign();
      if (!campaign) return { campaign: null, properties: [] };
      return { campaign, properties: await readProperties(campaign.slug) };
    } catch (err) {
      console.error("getFeaturedCampaign failed", err);
      return { campaign: null, properties: [] };
    }
  },
);

export const getProperty = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ campaign: slug, slug }).parse(input))
  .handler(async ({ data }) => {
    const { readCampaign, readProperties, readProperty } = await import("@/lib/property.server");
    try {
      const [campaign, property, siblings] = await Promise.all([
        readCampaign(data.campaign),
        readProperty(data.campaign, data.slug),
        readProperties(data.campaign),
      ]);
      return {
        campaign,
        property,
        related: siblings.filter((p) => p.slug !== data.slug).slice(0, 6),
      };
    } catch (err) {
      console.error("getProperty failed", err);
      return { campaign: null, property: null, related: [] as Property[] };
    }
  });

const enquiry = z.object({
  campaignSlug: slug,
  propertyIds: z.array(z.string().uuid()).max(20).default([]),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(40).optional(),
  country: z.string().trim().max(60).optional(),
  city: z.string().trim().max(60).optional(),
  preferredContact: z.enum(["email", "phone", "whatsapp"]).optional(),
  budget: z.string().trim().max(40).optional(),
  message: z.string().trim().max(1200).optional(),
  sourcePage: z.string().trim().max(200).optional(),
  referrer: z.string().trim().max(300).optional(),
  utm: z.record(z.string().max(120)).optional(),
});

/** Reader enquiry — one form can carry several shortlisted projects. */
export const submitPropertyEnquiry = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => enquiry.parse(input))
  .handler(async ({ data }) => {
    const { saveLead } = await import("@/lib/property.server");
    try {
      const res = await saveLead(data);
      return { ok: true as const, projects: res.projects };
    } catch (err) {
      console.error("submitPropertyEnquiry failed", err);
      return { ok: false as const, projects: [] as string[] };
    }
  });

/** Lightweight campaign analytics: views, developer clicks. */
export const trackPropertyEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        campaignSlug: slug,
        kind: z.enum(["page_view", "project_view", "developer_click", "brochure_click"]),
        propertyId: z.string().uuid().optional(),
        projectName: z.string().trim().max(160).optional(),
        developer: z.string().trim().max(160).optional(),
        path: z.string().trim().max(200).optional(),
        referrer: z.string().trim().max(300).optional(),
        utmSource: z.string().trim().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { recordMetric } = await import("@/lib/property.server");
    await recordMetric(data);
    return { ok: true as const };
  });

/** Advertiser performance report — editorial desk only. */
export const propertyCampaignStats = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ campaignSlug: slug, deskToken: z.string().max(400).optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { assertDesk } = await import("@/lib/desk-session.server");
    await assertDesk(data.deskToken);
    const { readCampaignStats } = await import("@/lib/property.server");
    return readCampaignStats(data.campaignSlug);
  });

/** Editable CMS fields for the campaign — editorial desk only. */
export const updateCampaign = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        campaignSlug: slug,
        deskToken: z.string().max(400).optional(),
        patch: z
          .object({
            headline: z.string().trim().max(160).optional(),
            subheading: z.string().trim().max(400).optional(),
            promo_title: z.string().trim().max(120).optional(),
            promo_line: z.string().trim().max(200).optional(),
            venue: z.string().trim().max(200).optional(),
            organizer: z.string().trim().max(120).optional(),
            event_start: z.string().trim().max(20).optional(),
            event_end: z.string().trim().max(20).optional(),
            event_month_label: z.string().trim().max(60).optional(),
            opening_hours: z.string().trim().max(120).optional(),
            official_url: z.string().trim().max(400).optional(),
            participation_note: z.string().trim().max(600).optional(),
            live_mode: z.boolean().optional(),
            live_note: z.string().trim().max(300).optional(),
            homepage_visible: z.boolean().optional(),
            post_event: z.boolean().optional(),
            active: z.boolean().optional(),
          })
          .strict(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { assertDesk } = await import("@/lib/desk-session.server");
    await assertDesk(data.deskToken);
    const { admin } = await import("@/lib/cms.server");
    const db = await admin();
    // Drop keys the editor left untouched so a partial save never blanks a field.
    const patch = Object.fromEntries(
      Object.entries(data.patch).filter(([, v]) => v !== undefined),
    ) as never;
    const { error } = await db
      .from("property_campaigns")
      .update(patch)
      .eq("slug", data.campaignSlug);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Public live feed for the campaign page (published posts only). */
export const getLiveFeed = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ campaignSlug: slug }).parse(input))
  .handler(async ({ data }) => {
    const { readLivePosts } = await import("@/lib/property.server");
    try {
      return { posts: await readLivePosts(data.campaignSlug) };
    } catch (err) {
      console.error("getLiveFeed failed", err);
      return { posts: [] as Awaited<ReturnType<typeof readLivePosts>> };
    }
  });

/** Editors publish photos, short videos and booth highlights during the show. */
export const saveLivePostFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        deskToken: z.string().max(400).optional(),
        id: z.string().uuid().optional(),
        campaignSlug: slug,
        kind: z.enum(["photo", "video", "booth"]),
        title: z.string().trim().min(2).max(160),
        body: z.string().trim().max(1200).optional(),
        mediaUrl: z.string().trim().max(600).url().optional(),
        posterUrl: z.string().trim().max(600).url().optional(),
        developer: z.string().trim().max(160).optional(),
        booth: z.string().trim().max(60).optional(),
        status: z.enum(["published", "draft"]).optional(),
        pinned: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { assertDesk } = await import("@/lib/desk-session.server");
    await assertDesk(data.deskToken);
    const { saveLivePost } = await import("@/lib/property.server");
    await saveLivePost(data);
    return { ok: true as const };
  });

export const deleteLivePostFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ deskToken: z.string().max(400).optional(), id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { assertDesk } = await import("@/lib/desk-session.server");
    await assertDesk(data.deskToken);
    const { deleteLivePost } = await import("@/lib/property.server");
    await deleteLivePost(data.id);
    return { ok: true as const };
  });

/** Desk view of every live post, drafts included. */
export const listLivePostsFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ deskToken: z.string().max(400).optional(), campaignSlug: slug }).parse(input),
  )
  .handler(async ({ data }) => {
    const { assertDesk } = await import("@/lib/desk-session.server");
    await assertDesk(data.deskToken);
    const { readLivePosts } = await import("@/lib/property.server");
    return { posts: await readLivePosts(data.campaignSlug, true) };
  });

/** Follow-up queue: every enquiry with its contact status. */
export const listPropertyLeads = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ deskToken: z.string().max(400).optional(), campaignSlug: slug }).parse(input),
  )
  .handler(async ({ data }) => {
    const { assertDesk } = await import("@/lib/desk-session.server");
    await assertDesk(data.deskToken);
    const { readLeads } = await import("@/lib/property.server");
    return { leads: await readLeads(data.campaignSlug) };
  });

export const updatePropertyLead = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        deskToken: z.string().max(400).optional(),
        id: z.string().uuid(),
        contactStatus: z
          .enum(["new", "contacted", "in_progress", "closed", "not_reachable"])
          .optional(),
        followUpNote: z.string().trim().max(600).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { assertDesk } = await import("@/lib/desk-session.server");
    await assertDesk(data.deskToken);
    const { updateLead } = await import("@/lib/property.server");
    await updateLead(data.id, {
      ...(data.contactStatus ? { contact_status: data.contactStatus } : {}),
      ...(data.followUpNote !== undefined ? { follow_up_note: data.followUpNote } : {}),
    });
    return { ok: true as const };
  });
