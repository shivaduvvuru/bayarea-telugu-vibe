/**
 * Shared, client-safe types and helpers for property-show campaigns.
 *
 * The campaign is a reusable template: the CREDAI Hyderabad 2026 page is one
 * row in `property_campaigns`, so later shows (Chennai, Bengaluru, NRI expos)
 * only need another row plus their own property records — no new code.
 */

export type PropertyCampaign = {
  slug: string;
  name: string;
  headline: string;
  subheading: string | null;
  promo_title: string | null;
  promo_line: string | null;
  venue: string | null;
  city: string | null;
  organizer: string | null;
  event_start: string | null;
  event_end: string | null;
  event_month_label: string | null;
  opening_hours: string | null;
  official_url: string | null;
  map_url: string | null;
  participation_note: string | null;
  hero_image_url: string | null;
  active: boolean;
  homepage_visible: boolean;
  post_event: boolean;
  campaign_start: string | null;
  campaign_end: string | null;
  /** Editors flip this on during the show to publish on-site updates. */
  live_mode: boolean;
  live_note: string | null;
};

export type LivePostKind = "photo" | "video" | "booth";

export type LivePost = {
  id: string;
  campaign_slug: string;
  kind: LivePostKind;
  title: string;
  body: string | null;
  media_url: string | null;
  poster_url: string | null;
  developer: string | null;
  booth: string | null;
  status: string;
  pinned: boolean;
  created_at: string;
};

export const LIVE_POST_COLUMNS =
  "id, campaign_slug, kind, title, body, media_url, poster_url, developer, booth, status, pinned, created_at";

export const LIVE_POST_KINDS: { key: LivePostKind; label: string }[] = [
  { key: "photo", label: "Photo" },
  { key: "video", label: "Short video" },
  { key: "booth", label: "Booth highlight" },
];

export type Property = {
  id: string;
  campaign_slug: string;
  slug: string;
  project_name: string;
  developer: string;
  developer_logo_url: string | null;
  locality: string | null;
  zone: string | null;
  property_type: string | null;
  price_from_lakh: number | null;
  price_note: string | null;
  configuration: string | null;
  project_status: string | null;
  rera_number: string | null;
  image_url: string | null;
  gallery_urls: string[];
  description: string | null;
  amenities: string[];
  is_tt_advertiser: boolean;
  is_credai_participant: boolean;
  website_url: string | null;
  enquiry_url: string | null;
  contact_phone: string | null;
  source_url: string | null;
  source_name: string | null;
  priority: number;
  status: string;
};

export const CAMPAIGN_COLUMNS =
  "slug, name, headline, subheading, promo_title, promo_line, venue, city, organizer, event_start, event_end, event_month_label, opening_hours, official_url, map_url, participation_note, hero_image_url, active, homepage_visible, post_event, campaign_start, campaign_end, live_mode, live_note";

export const PROPERTY_COLUMNS =
  "id, campaign_slug, slug, project_name, developer, developer_logo_url, locality, zone, property_type, price_from_lakh, price_note, configuration, project_status, rera_number, image_url, gallery_urls, description, amenities, is_tt_advertiser, is_credai_participant, website_url, enquiry_url, contact_phone, source_url, source_name, priority, status";

/** Campaign code stitched onto every lead and metric row for reporting. */
export const CAMPAIGN_CODES: Record<string, string> = {
  "credai-hyderabad-2026": "CREDAI_2026",
};

export function campaignCode(slug: string) {
  return CAMPAIGN_CODES[slug] ?? slug.toUpperCase().replace(/-/g, "_");
}

export const PROPERTY_TYPES = [
  "Apartments",
  "Villas",
  "Plots",
  "Commercial",
  "Luxury",
  "Senior Living",
] as const;

export const PROJECT_STATUSES = ["Ready to Move", "Under Construction", "New Launch"] as const;

export type BudgetBand = {
  key: string;
  label: string;
  /** Inclusive lower bound in lakh; upper bound exclusive. */
  min: number;
  max: number | null;
};

export const BUDGET_BANDS: BudgetBand[] = [
  { key: "u1", label: "Under ₹1 Cr", min: 0, max: 100 },
  { key: "1-2", label: "₹1–2 Cr", min: 100, max: 200 },
  { key: "2-3", label: "₹2–3 Cr", min: 200, max: 300 },
  { key: "3-5", label: "₹3–5 Cr", min: 300, max: 500 },
  { key: "5p", label: "₹5 Cr+", min: 500, max: null },
];

/** Only offer bands that actually match inventory. */
export function usableBudgetBands(items: Property[]) {
  return BUDGET_BANDS.filter((b) =>
    items.some(
      (p) =>
        p.price_from_lakh != null &&
        p.price_from_lakh >= b.min &&
        (b.max == null || p.price_from_lakh < b.max),
    ),
  );
}

export function inBudget(p: Property, band: BudgetBand | undefined) {
  if (!band) return true;
  if (p.price_from_lakh == null) return false;
  return p.price_from_lakh >= band.min && (band.max == null || p.price_from_lakh < band.max);
}

/** "₹83 L" / "₹1.25 Cr" — never invented, only formatted. */
export function priceLabel(p: Pick<Property, "price_from_lakh">) {
  const v = p.price_from_lakh;
  if (v == null) return "Price on request";
  if (v >= 100) {
    const cr = v / 100;
    return `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(2)} Cr onwards`;
  }
  return `₹${v.toFixed(0)} L onwards`;
}

export type PropertyFilters = {
  locality?: string | undefined;
  type?: string | undefined;
  status?: string | undefined;
  budget?: string | undefined;
};

/**
 * Ranking: Telugu Times advertisers first, then confirmed show participants,
 * then editorial priority, then data completeness. Filters always win — a
 * sponsored project never appears for a filter it does not match.
 */
export function rankProperties(items: Property[], filters: PropertyFilters) {
  const band = BUDGET_BANDS.find((b) => b.key === filters.budget);
  const matched = items.filter(
    (p) =>
      (!filters.locality || p.locality === filters.locality) &&
      (!filters.type || p.property_type === filters.type) &&
      (!filters.status || p.project_status === filters.status) &&
      inBudget(p, band),
  );
  const completeness = (p: Property) =>
    [p.image_url, p.description, p.configuration, p.locality, p.price_from_lakh, p.rera_number]
      .filter(Boolean).length;
  return matched.sort(
    (a, b) =>
      Number(b.is_tt_advertiser) - Number(a.is_tt_advertiser) ||
      Number(b.is_credai_participant) - Number(a.is_credai_participant) ||
      b.priority - a.priority ||
      completeness(b) - completeness(a) ||
      a.project_name.localeCompare(b.project_name),
  );
}

export function localities(items: Property[]) {
  return [...new Set(items.map((p) => p.locality).filter((v): v is string => !!v))].sort();
}

/** "28–30 August 2026" from the stored dates; blank when dates are missing. */
export function eventDateLabel(c: Pick<PropertyCampaign, "event_start" | "event_end" | "event_month_label">) {
  if (!c.event_start) return c.event_month_label ?? "";
  const start = new Date(`${c.event_start}T00:00:00Z`);
  const end = c.event_end ? new Date(`${c.event_end}T00:00:00Z`) : null;
  const month = start.toLocaleDateString("en-US", { timeZone: "UTC", month: "long" });
  const year = start.getUTCFullYear();
  if (!end || end.getTime() === start.getTime()) {
    return `${start.getUTCDate()} ${month} ${year}`;
  }
  return `${start.getUTCDate()}–${end.getUTCDate()} ${month} ${year}`;
}

export type CampaignPhase = "upcoming" | "live" | "past";

export function campaignPhase(
  c: Pick<PropertyCampaign, "event_start" | "event_end" | "post_event">,
  now = new Date(),
): CampaignPhase {
  if (c.post_event) return "past";
  if (!c.event_start) return "upcoming";
  const start = new Date(`${c.event_start}T00:00:00Z`).getTime();
  const end = new Date(`${c.event_end ?? c.event_start}T23:59:59Z`).getTime();
  const t = now.getTime();
  if (t < start) return "upcoming";
  if (t > end) return "past";
  return "live";
}

/** Whether the homepage module should show right now. */
export function promoVisible(c: PropertyCampaign, now = new Date()) {
  if (!c.active || !c.homepage_visible) return false;
  const t = now.getTime();
  if (c.campaign_start && t < new Date(c.campaign_start).getTime()) return false;
  if (c.campaign_end && t > new Date(c.campaign_end).getTime()) return false;
  return true;
}

export function campaignPath(slug: string) {
  return `/property/${slug}`;
}

export function propertyPath(campaign: string, slug: string) {
  return `/property/${campaign}/${slug}`;
}

/** Short, concrete NRI guidance — informational, never advertiser copy. */
export const NRI_GUIDES = [
  {
    title: "NRI buying checklist",
    body: "Confirm title, RERA registration, approved plans, encumbrance certificate and the builder's delivery record before paying anything.",
  },
  {
    title: "PAN and banking",
    body: "You need an Indian PAN, and payments must move through NRE/NRO/FCNR accounts or normal banking channels — not cash.",
  },
  {
    title: "Power of Attorney",
    body: "If you cannot travel, a notarised and apostilled special PoA lets a trusted relative sign and register on your behalf.",
  },
  {
    title: "Home loans",
    body: "Indian banks lend to NRIs, usually with shorter tenures and a resident co-applicant. Compare rates before committing.",
  },
  {
    title: "TDS on purchase",
    body: "Tax is deducted at source when you buy; the rate depends on the seller's residency status and the value of the property.",
  },
  {
    title: "RERA verification",
    body: "Search the project's RERA number on the Telangana RERA portal and match the promised completion date with the brochure.",
  },
  {
    title: "Repatriation basics",
    body: "Sale proceeds can generally be repatriated within RBI limits, with tax clearance and the right documentation.",
  },
  {
    title: "Registration process",
    body: "Registration happens at the sub-registrar office in Telangana; budget for stamp duty and registration charges on top of price.",
  },
  {
    title: "Questions for the developer",
    body: "Ask about carpet vs super built-up area, maintenance charges, parking, hand-over schedule and penalty clauses for delay.",
  },
] as const;

/** Short label + expandable detail for the NRI education cards. */
export const NRI_TOPIC_ORDER = [
  "PAN and banking",
  "Power of Attorney",
  "Home loans",
  "TDS on purchase",
  "RERA verification",
  "Repatriation basics",
  "Registration process",
] as const;

/** The seven core topics first, then the remaining guides. */
export function orderedNriGuides() {
  const rank = (t: string) => {
    const i = (NRI_TOPIC_ORDER as readonly string[]).indexOf(t);
    return i === -1 ? 99 : i;
  };
  return [...NRI_GUIDES].sort((a, b) => rank(a.title) - rank(b.title));
}

export type DeveloperSummary = {
  name: string;
  logo: string | null;
  isAdvertiser: boolean;
  isParticipant: boolean;
  projects: Property[];
  localities: string[];
};

/**
 * "Meet these developers" — one entry per confirmed developer, advertisers
 * first, each keeping links to its own project cards.
 */
export function developerLineup(items: Property[]): DeveloperSummary[] {
  const map = new Map<string, DeveloperSummary>();
  for (const p of items) {
    if (!p.developer) continue;
    const entry =
      map.get(p.developer) ??
      ({
        name: p.developer,
        logo: null,
        isAdvertiser: false,
        isParticipant: false,
        projects: [],
        localities: [],
      } satisfies DeveloperSummary);
    entry.logo ??= p.developer_logo_url;
    entry.isAdvertiser = entry.isAdvertiser || p.is_tt_advertiser;
    entry.isParticipant = entry.isParticipant || p.is_credai_participant;
    entry.projects.push(p);
    if (p.locality && !entry.localities.includes(p.locality)) entry.localities.push(p.locality);
    map.set(p.developer, entry);
  }
  return [...map.values()].sort(
    (a, b) =>
      Number(b.isAdvertiser) - Number(a.isAdvertiser) ||
      Number(b.isParticipant) - Number(a.isParticipant) ||
      b.projects.length - a.projects.length ||
      a.name.localeCompare(b.name),
  );
}

export const LEAD_STATUSES = ["new", "contacted", "in_progress", "closed", "not_reachable"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export function leadStatusLabel(s: string) {
  return (
    {
      new: "New",
      contacted: "Contacted",
      in_progress: "In progress",
      closed: "Closed",
      not_reachable: "Not reachable",
    }[s] ?? s
  );
}

/** Coarse attribution for reporting: U.S. diaspora vs India vs elsewhere. */
export function leadRegion(country: string | null | undefined): "USA" | "India" | "Other" {
  const v = (country ?? "").trim().toLowerCase();
  if (!v) return "Other";
  if (/(^|\b)(usa|us|u\.s\.|united states|america)\b/.test(v)) return "USA";
  if (/(^|\b)(india|bharat|in)\b/.test(v)) return "India";
  return "Other";
}
