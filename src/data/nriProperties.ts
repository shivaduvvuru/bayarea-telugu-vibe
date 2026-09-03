/**
 * Curated luxury inventory for the NRI Real Estate showcase. These entries are
 * the editorial shortlist presented to Bay Area investors; the anniversary-edition
 * tower artwork used in the hero comes from `@/lib/property-showcase`.
 */
export interface PropertyItem {
  id: string;
  title: string;
  developer: string;
  location: string;
  type: "villa" | "highrise" | "agro";
  priceINR: string;
  priceUSD: string;
  sqft: string;
  possession: string;
  roiEstimate: string;
  reraApproved: boolean;
  badge?: string;
  image: string;
  virtualTourUrl?: string;
}

export const NRI_FILTERS = [
  { key: "all", label: "All" },
  { key: "villa", label: "Villas (Kokapet / Gandipet)" },
  { key: "highrise", label: "Sky Mansions (Financial Dist / Neopolis)" },
  { key: "agro", label: "Managed Agro / Farm Communities" },
] as const;

export type NriFilterKey = (typeof NRI_FILTERS)[number]["key"];

const EPAPER = "https://www.telugutimes.net/wp-content/uploads/2026/03";

export const luxuryProperties: PropertyItem[] = [
  {
    id: "prop-1",
    title: "The Sky Mansions at Neopolis",
    developer: "CREDAI Premier Member",
    location: "Kokapet / Neopolis, Hyderabad",
    type: "highrise",
    priceINR: "Contact developer",
    priceUSD: "Contact developer",
    sqft: "4,200 – 8,900 sq.ft.",
    possession: "Verify with builder",
    roiEstimate: "Verify with builder",
    reraApproved: true,
    badge: "Pre-launch window",
    image: `${EPAPER}/26.jpg`,
  },
  {
    id: "prop-2",
    title: "Serene Gated Waterfront Villas",
    developer: "CREDAI Signature Builder",
    location: "Gandipet / Osman Sagar, Hyderabad",
    type: "villa",
    priceINR: "Contact developer",
    priceUSD: "Contact developer",
    sqft: "5,400 – 11,000 sq.ft.",
    possession: "Verify with builder",
    roiEstimate: "Verify with builder",
    reraApproved: true,
    badge: "CREDAI verified",
    image: `${EPAPER}/23.jpg`,
  },
  {
    id: "prop-3",
    title: "Skymarq by DSR — Signature Towers",
    developer: "DSR Builders",
    location: "Financial District, Hyderabad",
    type: "highrise",
    priceINR: "Contact developer",
    priceUSD: "Contact developer",
    sqft: "3,300 – 7,600 sq.ft. · 4, 7 & 11 BHK",
    possession: "Verify with builder",
    roiEstimate: "Verify with builder",
    reraApproved: true,
    badge: "CREDAI verified",
    image: `${EPAPER}/3-1.jpg`,
  },
  {
    id: "prop-4",
    title: "The Triilight, Kokapet Golden Mile",
    developer: "Triilight",
    location: "Kokapet Golden Mile, Hyderabad",
    type: "highrise",
    priceINR: "Contact developer",
    priceUSD: "Contact developer",
    sqft: "2,888 – 5,777 sq.ft.",
    possession: "Verify with builder",
    roiEstimate: "Verify with builder",
    reraApproved: true,
    image: `${EPAPER}/18-1.jpg`,
  },
  {
    id: "prop-5",
    title: "My Home Udyan — The Park Life",
    developer: "My Home Group",
    location: "Tellapur, Hyderabad",
    type: "highrise",
    priceINR: "Contact developer",
    priceUSD: "Contact developer",
    sqft: "1,350 – 2,915 sq.ft. · 24.12 acres",
    possession: "Verify with builder",
    roiEstimate: "Verify with builder",
    reraApproved: true,
    image: `${EPAPER}/2-1.jpg`,
  },
  {
    id: "prop-6",
    title: "Casa Lagoona Estate Villas",
    developer: "Rajapushpa Properties",
    location: "ORR corridor, Hyderabad",
    type: "villa",
    priceINR: "Contact developer",
    priceUSD: "Contact developer",
    sqft: "4,000 – 6,500 sq.ft.",
    possession: "Verify with builder",
    roiEstimate: "Verify with builder",
    reraApproved: true,
    image: `${EPAPER}/23.jpg`,
  },
  {
    id: "prop-7",
    title: "Managed Mango & Teak Farm Estates",
    developer: "CREDAI associate — managed estates",
    location: "Airport corridor / Shadnagar, Telangana",
    type: "agro",
    priceINR: "Contact developer",
    priceUSD: "Contact developer",
    sqft: "0.5 – 2.0 acre plots",
    possession: "Verify with builder",
    roiEstimate: "Verify with builder",
    reraApproved: true,
    badge: "Fully managed",
    image: `${EPAPER}/22.jpg`,
  },
  {
    id: "prop-8",
    title: "Amaravati Riverfront Farm Villas",
    developer: "CREDAI AP member",
    location: "Amaravati capital region, Andhra Pradesh",
    type: "agro",
    priceINR: "Contact developer",
    priceUSD: "Contact developer",
    sqft: "1.0 – 3.0 acre estates",
    possession: "Verify with builder",
    roiEstimate: "Verify with builder",
    reraApproved: true,
    image: `${EPAPER}/27.jpg`,
  },
];

export const TRUST_POINTS = [
  {
    title: "RERA & title verification",
    body: "Confirm RERA registration and legal title directly with the developer before purchase.",
  },
  {
    title: "Independent valuation",
    body: "Get an independent market valuation; projected yields are estimates only.",
  },
  {
    title: "NRI concierge",
    body: "Assisted family site visits, POA documentation, registration and handover without a trip to India.",
  },
  {
    title: "Repatriation & FEMA support",
    body: "NRE/NRO fund routing, TDS and repatriation guidance from cross-border advisors.",
  },
];

export const PARTNERS = [
  "TimesBayArea.com",
  "CREDAI Hyderabad",
  "BATA",
  "TANA",
  "NATS",
];

export const BAY_AREA_CITIES = [
  "San Jose",
  "Fremont",
  "Sunnyvale",
  "Cupertino",
  "Milpitas",
  "Santa Clara",
  "Pleasanton",
  "San Ramon",
  "Dublin",
  "San Francisco",
  "Seattle",
  "Dallas",
  "Other",
];

export const BUDGET_RANGES = [
  "Under $250K",
  "$250K – $500K",
  "$500K – $1M",
  "$1M – $2M",
  "$2M+",
];

export const MICRO_MARKETS = [
  "Kokapet / Neopolis",
  "Financial District",
  "Gandipet / Osman Sagar",
  "Tellapur",
  "ORR / Airport corridor",
  "Amaravati / Vijayawada",
  "Visakhapatnam",
  "Not sure yet",
];

/** WhatsApp concierge desk. Digits only, international format. */
export const CONCIERGE_WHATSAPP = "14085550117";

export function whatsappLink(message: string): string {
  return `https://wa.me/${CONCIERGE_WHATSAPP}?text=${encodeURIComponent(message.slice(0, 800))}`;
}
