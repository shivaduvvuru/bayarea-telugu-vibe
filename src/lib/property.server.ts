import {
  CAMPAIGN_COLUMNS,
  PROPERTY_COLUMNS,
  campaignCode,
  type Property,
  type PropertyCampaign,
} from "@/lib/property";

/** Public reads go through the anon client so RLS stays in force. */
async function pub() {
  const { publicClient } = await import("@/lib/cms.server");
  return publicClient();
}

async function db() {
  const { admin } = await import("@/lib/cms.server");
  return admin();
}

export async function readCampaign(slug: string): Promise<PropertyCampaign | null> {
  const { data } = await (await pub())
    .from("property_campaigns")
    .select(CAMPAIGN_COLUMNS)
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  return (data as unknown as PropertyCampaign | null) ?? null;
}

/** The campaign the homepage module should promote, if any. */
export async function readFeaturedCampaign(): Promise<PropertyCampaign | null> {
  const { data } = await (await pub())
    .from("property_campaigns")
    .select(CAMPAIGN_COLUMNS)
    .eq("active", true)
    .eq("homepage_visible", true)
    .order("event_start", { ascending: true })
    .limit(1);
  return ((data ?? [])[0] as unknown as PropertyCampaign | undefined) ?? null;
}

export async function readProperties(campaignSlug: string): Promise<Property[]> {
  const { data } = await (await pub())
    .from("properties")
    .select(PROPERTY_COLUMNS)
    .eq("campaign_slug", campaignSlug)
    .eq("status", "published")
    .order("priority", { ascending: false })
    .limit(300);
  return (data ?? []) as unknown as Property[];
}

export async function readProperty(campaignSlug: string, slug: string): Promise<Property | null> {
  const { data } = await (await pub())
    .from("properties")
    .select(PROPERTY_COLUMNS)
    .eq("campaign_slug", campaignSlug)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return (data as unknown as Property | null) ?? null;
}

export type MetricInput = {
  campaignSlug: string;
  kind: string;
  propertyId?: string | undefined;
  projectName?: string | undefined;
  developer?: string | undefined;
  country?: string | undefined;
  path?: string | undefined;
  referrer?: string | undefined;
  utmSource?: string | undefined;
};

/** Fire-and-forget counter; analytics must never break a page. */
export async function recordMetric(m: MetricInput) {
  try {
    await (await db()).from("property_metrics").insert({
      campaign_slug: m.campaignSlug,
      kind: m.kind,
      property_id: m.propertyId ?? null,
      project_name: m.projectName ?? null,
      developer: m.developer ?? null,
      country: m.country ?? null,
      path: m.path ?? null,
      referrer: m.referrer ?? null,
      utm_source: m.utmSource ?? null,
    });
  } catch (err) {
    console.error("property metric failed", err);
  }
}

export type LeadInput = {
  campaignSlug: string;
  propertyIds: string[];
  name: string;
  email: string;
  phone?: string | undefined;
  country?: string | undefined;
  city?: string | undefined;
  preferredContact?: string | undefined;
  budget?: string | undefined;
  message?: string | undefined;
  sourcePage?: string | undefined;
  referrer?: string | undefined;
  utm?: Record<string, string> | undefined;
};

/**
 * Stores an enquiry against the projects the reader picked. Project names and
 * developers are resolved server-side so the browser cannot spoof attribution.
 */
export async function saveLead(input: LeadInput) {
  const client = await db();
  const ids = input.propertyIds.slice(0, 20);
  let projects: { id: string; project_name: string; developer: string }[] = [];
  if (ids.length > 0) {
    const { data } = await client
      .from("properties")
      .select("id, project_name, developer")
      .in("id", ids);
    projects = (data ?? []) as typeof projects;
  }
  const { error } = await client.from("property_leads").insert({
    campaign_slug: input.campaignSlug,
    campaign_code: campaignCode(input.campaignSlug),
    property_ids: projects.map((p) => p.id),
    project_names: projects.map((p) => p.project_name),
    developers: [...new Set(projects.map((p) => p.developer))],
    name: input.name,
    email: input.email,
    phone: input.phone ?? null,
    country: input.country ?? null,
    city: input.city ?? null,
    preferred_contact: input.preferredContact ?? null,
    budget: input.budget ?? null,
    message: input.message ?? null,
    source_page: input.sourcePage ?? null,
    referrer: input.referrer ?? null,
    utm: input.utm ?? {},
  });
  if (error) throw new Error(error.message);

  await recordMetric({
    campaignSlug: input.campaignSlug,
    kind: "enquiry",
    country: input.country,
    path: input.sourcePage,
    projectName: projects[0]?.project_name,
    developer: projects[0]?.developer,
  });
  return { projects: projects.map((p) => p.project_name) };
}

export type CampaignStats = {
  pageViews: number;
  projectViews: number;
  developerClicks: number;
  enquiries: number;
  byProject: { name: string; views: number; enquiries: number }[];
  byCountry: { country: string; enquiries: number }[];
  recentLeads: {
    created_at: string;
    name: string;
    email: string;
    phone: string | null;
    country: string | null;
    budget: string | null;
    project_names: string[];
    message: string | null;
  }[];
};

/** Advertiser reporting: views, clicks and enquiries per project. */
export async function readCampaignStats(campaignSlug: string): Promise<CampaignStats> {
  const client = await db();
  const [{ data: metrics }, { data: leads }] = await Promise.all([
    client
      .from("property_metrics")
      .select("kind, project_name, country")
      .eq("campaign_slug", campaignSlug)
      .limit(5000),
    client
      .from("property_leads")
      .select("created_at, name, email, phone, country, budget, project_names, message")
      .eq("campaign_slug", campaignSlug)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const rows = (metrics ?? []) as { kind: string; project_name: string | null; country: string | null }[];
  const count = (kind: string) => rows.filter((r) => r.kind === kind).length;
  const projects = new Map<string, { views: number; enquiries: number }>();
  const countries = new Map<string, number>();
  for (const r of rows) {
    if (r.project_name) {
      const e = projects.get(r.project_name) ?? { views: 0, enquiries: 0 };
      if (r.kind === "project_view") e.views += 1;
      if (r.kind === "enquiry") e.enquiries += 1;
      projects.set(r.project_name, e);
    }
    if (r.kind === "enquiry" && r.country) {
      countries.set(r.country, (countries.get(r.country) ?? 0) + 1);
    }
  }

  return {
    pageViews: count("page_view"),
    projectViews: count("project_view"),
    developerClicks: count("developer_click"),
    enquiries: count("enquiry"),
    byProject: [...projects.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.views - a.views || b.enquiries - a.enquiries)
      .slice(0, 20),
    byCountry: [...countries.entries()]
      .map(([country, enquiries]) => ({ country, enquiries }))
      .sort((a, b) => b.enquiries - a.enquiries),
    recentLeads: (leads ?? []) as CampaignStats["recentLeads"],
  };
}

/* ------------------------------------------------------------------ *
 * Live from the venue
 * ------------------------------------------------------------------ */

export async function readLivePosts(campaignSlug: string, includeDrafts = false) {
  const { LIVE_POST_COLUMNS } = await import("@/lib/property");
  const client = includeDrafts ? await db() : await pub();
  let q = client
    .from("property_live_posts")
    .select(LIVE_POST_COLUMNS)
    .eq("campaign_slug", campaignSlug)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(120);
  if (!includeDrafts) q = q.eq("status", "published");
  const { data } = await q;
  return (data ?? []) as unknown as import("@/lib/property").LivePost[];
}

export type LivePostInput = {
  id?: string | undefined;
  campaignSlug: string;
  kind: string;
  title: string;
  body?: string | undefined;
  mediaUrl?: string | undefined;
  posterUrl?: string | undefined;
  developer?: string | undefined;
  booth?: string | undefined;
  status?: string | undefined;
  pinned?: boolean | undefined;
};

export async function saveLivePost(input: LivePostInput) {
  const client = await db();
  const row = {
    campaign_slug: input.campaignSlug,
    kind: input.kind,
    title: input.title,
    body: input.body ?? null,
    media_url: input.mediaUrl ?? null,
    poster_url: input.posterUrl ?? null,
    developer: input.developer ?? null,
    booth: input.booth ?? null,
    status: input.status ?? "published",
    pinned: input.pinned ?? false,
  };
  const { error } = input.id
    ? await client.from("property_live_posts").update(row).eq("id", input.id)
    : await client.from("property_live_posts").insert(row);
  if (error) throw new Error(error.message);
}

export async function deleteLivePost(id: string) {
  const { error } = await (await db()).from("property_live_posts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------------ *
 * Lead follow-up queue
 * ------------------------------------------------------------------ */

export type LeadRow = {
  id: string;
  created_at: string;
  campaign_code: string;
  name: string;
  email: string;
  phone: string | null;
  country: string | null;
  city: string | null;
  budget: string | null;
  preferred_contact: string | null;
  message: string | null;
  project_names: string[];
  developers: string[];
  contact_status: string;
  follow_up_note: string | null;
};

const LEAD_COLUMNS =
  "id, created_at, campaign_code, name, email, phone, country, city, budget, preferred_contact, message, project_names, developers, contact_status, follow_up_note";

export async function readLeads(campaignSlug: string): Promise<LeadRow[]> {
  const { data, error } = await (await db())
    .from("property_leads")
    .select(LEAD_COLUMNS)
    .eq("campaign_slug", campaignSlug)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LeadRow[];
}

export async function updateLead(id: string, patch: { contact_status?: string; follow_up_note?: string }) {
  const { error } = await (await db())
    .from("property_leads")
    .update(patch as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
}
