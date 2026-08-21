/**
 * Curated luxury inventory for the NRI Real Estate showcase. These entries are
 * the editorial shortlist Telugu Times presents to Bay Area investors; the
 * anniversary-edition tower artwork used in the hero comes from
 * `@/lib/property-showcase`.
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
    priceINR: "₹6.5 Cr – ₹14 Cr",
    priceUSD: "~$780K – $1.68M",
    sqft: "4,200 – 8,900 sq.ft.",
    possession: "Dec 2028",
    roiEstimate: "11.4% annualized",
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
    priceINR: "₹8.0 Cr – ₹22 Cr",
    priceUSD: "~$960K – $2.6M",
    sqft: "5,400 – 11,000 sq.ft.",
    possession: "Mar 2029",
    roiEstimate: "13.2% capital appreciation",
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
    priceINR: "₹4.9 Cr – ₹12 Cr",
    priceUSD: "~$590K – $1.44M",
    sqft: "3,300 – 7,600 sq.ft. · 4, 7 & 11 BHK",
    possession: "Jun 2029",
    roiEstimate: "10.6% annualized",
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
    priceINR: "from ₹3.43 Cr",
    priceUSD: "~from $412K",
    sqft: "2,888 – 5,777 sq.ft.",
    possession: "Sep 2028",
    roiEstimate: "9.8% annualized",
    reraApproved: true,
    image: `${EPAPER}/18-1.jpg`,
  },
  {
    id: "prop-5",
    title: "My Home Udyan — The Park Life",
    developer: "My Home Group",
    location: "Tellapur, Hyderabad",
    type: "highrise",
    priceINR: "₹1.6 Cr – ₹4.2 Cr",
    priceUSD: "~$192K – $505K",
    sqft: "1,350 – 2,915 sq.ft. · 24.12 acres",
    possession: "Dec 2029",
    roiEstimate: "9.2% annualized",
    reraApproved: true,
    image: `${EPAPER}/2-1.jpg`,
  },
  {
    id: "prop-6",
    title: "Casa Lagoona Estate Villas",
    developer: "Rajapushpa Properties",
    location: "ORR corridor, Hyderabad",
    type: "villa",
    priceINR: "₹5.2 Cr – ₹9.4 Cr",
    priceUSD: "~$625K – $1.13M",
    sqft: "4,000 – 6,500 sq.ft.",
    possession: "Aug 2028",
    roiEstimate: "12.1% capital appreciation",
    reraApproved: true,
    image: `${EPAPER}/23.jpg`,
  },
  {
    id: "prop-7",
    title: "Managed Mango & Teak Farm Estates",
    developer: "CREDAI associate — managed estates",
    location: "Airport corridor / Shadnagar, Telangana",
    type: "agro",
    priceINR: "₹85 L – ₹3.2 Cr",
    priceUSD: "~$102K – $385K",
    sqft: "0.5 – 2.0 acre plots",
    possession: "Ready + managed",
    roiEstimate: "7.5% yield + land appreciation",
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
    priceINR: "₹1.4 Cr – ₹4.8 Cr",
    priceUSD: "~$168K – $575K",
    sqft: "1.0 – 3.0 acre estates",
    possession: "Phase-wise 2027–28",
    roiEstimate: "14% projected appreciation",
    reraApproved: true,
    image: `${EPAPER}/27.jpg`,
  },
];

export const TRUST_POINTS = [
  {
    title: "100% RERA & clear title",
    body: "Every project is CREDAI-listed with RERA registration and legal title verification before it is shown here.",
  },
  {
    title: "High rental yield & capital growth",
    body: "Micro-markets picked for tenant demand — Financial District, Neopolis, Kokapet and the ORR corridor.",
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
  "Telugu Times",
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
