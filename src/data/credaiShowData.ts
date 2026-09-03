/**
 * CREDAI Hyderabad Property Show 2026 (Aug 28–30, HITEX) expo hub data.
 * Project artwork reuses the anniversary special pages.
 */
export interface CredaiProject {
  id: string;
  name: string;
  developer: string;
  location: string;
  type: "Villa" | "High-Rise Apartment" | "Commercial" | "Plot";
  market: "highrise" | "villa" | "corridor";
  priceINR: string;
  priceUSD: string;
  possession: string;
  reraNumber: string;
  imageUrl: string;
  highlights: string[];
}

const EPAPER = "https://www.telugutimes.net/wp-content/uploads/2026/03";

/** Show start, in India time. */
export const SHOW_START_ISO = "2026-08-28T09:00:00+05:30";
export const SHOW_END_ISO = "2026-08-30T20:00:00+05:30";
export const SHOW_TAGLINE = "Rate Aagadhu – Demand Thaggadhu";
export const SHOW_VENUE = "HITEX Exhibition Centre, Hyderabad";

/** NRI property desk — digits only, international format. */
export const NRI_DESK_WHATSAPP = "14085550117";
export const NRI_DESK_NAME = "Mr. I V Rao";

export function deskWhatsappLink(
  message = `Hello ${NRI_DESK_NAME}, I am interested in the CREDAI Aug 28-30 Property Show projects.`,
): string {
  return `https://wa.me/${NRI_DESK_WHATSAPP}?text=${encodeURIComponent(message.slice(0, 800))}`;
}

export const SHOW_BADGES = [
  "300+ RERA-approved projects",
  "70+ Grade-A builders",
  "Dedicated NRI buying desk",
];

export const MICRO_MARKET_TABS = [
  { key: "all", label: "All" },
  { key: "highrise", label: "Neopolis & Kokapet (High Rise)" },
  { key: "villa", label: "Gandipet & Mokila (Luxury Villas)" },
  { key: "corridor", label: "Airport / Pharma City Corridor" },
] as const;

export type MicroMarketKey = (typeof MICRO_MARKET_TABS)[number]["key"];

export const PROXY_SERVICES = [
  {
    title: "Virtual stall walkthroughs",
    body: "Live 3D walkthroughs from the HITEX floor and real-time floor plans sent straight to your phone.",
  },
  {
    title: "Legal & RERA due diligence",
    body: "Pre-vetted clear titles, RERA registrations and builder delivery track records curated by Times Bay Area.",
  },
  {
    title: "Family assisted site visits",
    body: "Our Hyderabad concierge team coordinates zero-hassle site visits for your parents and relatives.",
  },
];

/** Hero showcase slides 2–4: vertical skyscraper ad pages with US-investor notes. */
export interface ShowcaseSlide {
  id: string;
  developer: string;
  project: string;
  location: string;
  yieldNote: string;
  possession: string;
  imageUrl: string;
  site?: string | undefined;
}

export const showcaseSlides: ShowcaseSlide[] = [
  {
    id: "3-1",
    developer: "DSR Builders",
    project: "Skymarq by DSR",
    location: "Financial District, Hyderabad",
    yieldNote: "Projected 10.6% annualized yield · 4, 7 & 11 BHK sky homes",
    possession: "Jun 2029",
    imageUrl: `${EPAPER}/3-1.jpg`,
    site: "https://dsrbuilders.in",
  },
  {
    id: "26",
    developer: "Sattva Group",
    project: "Sattva Lakeridge",
    location: "Neopolis, Kokapet",
    yieldNote: "Projected 11.4% annualized yield · lake-facing towers",
    possession: "Dec 2028",
    imageUrl: `${EPAPER}/26.jpg`,
    site: "https://sattvalakeridgeneopolis.com",
  },
  {
    id: "18-1",
    developer: "Triilight",
    project: "The Triilight, Kokapet Golden Mile",
    location: "Kokapet Golden Mile, Hyderabad",
    yieldNote: "From ₹3.43 Cr · 2,888–5,777 sq.ft. · 9.8% projected yield",
    possession: "Sep 2028",
    imageUrl: `${EPAPER}/18-1.jpg`,
    site: "https://www.thetriilight.com",
  },
];

export const credaiShowProjects: CredaiProject[] = [
  {
    id: "credai-01",
    name: "Neopolis Sky Mansions",
    developer: "Grade-A CREDAI Developer",
    location: "Kokapet / Neopolis, Hyderabad",
    type: "High-Rise Apartment",
    market: "highrise",
    priceINR: "Contact developer",
    priceUSD: "Contact developer",
    possession: "Verify with builder",
    reraNumber: "Verify with builder",
    imageUrl: `${EPAPER}/26.jpg`,
    highlights: ["100% Vastu compliant", "50,000 sq.ft clubhouse", "10 min to Financial District"],
  },
  {
    id: "credai-02",
    name: "Gandipet Lakeside Villas",
    developer: "Signature CREDAI Builder",
    location: "Gandipet / Osman Sagar corridor",
    type: "Villa",
    market: "villa",
    priceINR: "Contact developer",
    priceUSD: "Contact developer",
    possession: "Verify with builder",
    reraNumber: "Verify with builder",
    imageUrl: `${EPAPER}/23.jpg`,
    highlights: ["Private plunge pools", "4 & 5 BHK layouts", "Gated eco-community"],
  },
  {
    id: "credai-03",
    name: "Skymarq Signature Towers",
    developer: "DSR Builders",
    location: "Financial District, Hyderabad",
    type: "High-Rise Apartment",
    market: "highrise",
    priceINR: "Contact developer",
    priceUSD: "Contact developer",
    possession: "Verify with builder",
    reraNumber: "Verify with builder",
    imageUrl: `${EPAPER}/3-1.jpg`,
    highlights: ["4, 7 & 11 BHK", "Sky lounges on every 10th floor", "Metro-linked corridor"],
  },
  {
    id: "credai-04",
    name: "Mokila Estate Villas",
    developer: "CREDAI Premier Member",
    location: "Mokila, Hyderabad",
    type: "Villa",
    market: "villa",
    priceINR: "Contact developer",
    priceUSD: "Contact developer",
    possession: "Verify with builder",
    reraNumber: "Verify with builder",
    imageUrl: `${EPAPER}/22.jpg`,
    highlights: ["Triple-height living", "Managed rentals", "Near ORR exit 13"],
  },
  {
    id: "credai-05",
    name: "Airport Corridor Business Suites",
    developer: "CREDAI Commercial Member",
    location: "Airport corridor, Shamshabad",
    type: "Commercial",
    market: "corridor",
    priceINR: "Contact developer",
    priceUSD: "Contact developer",
    possession: "Verify with builder",
    reraNumber: "Verify with builder",
    imageUrl: `${EPAPER}/27.jpg`,
    highlights: ["Pre-leased options", "8.5% rental yield", "Zero-hassle property management"],
  },
  {
    id: "credai-06",
    name: "Pharma City Growth Plots",
    developer: "CREDAI Plotted Development",
    location: "Pharma City corridor, Telangana",
    type: "Plot",
    market: "corridor",
    priceINR: "Contact developer",
    priceUSD: "Contact developer",
    possession: "Verify with builder",
    reraNumber: "Verify with builder",
    imageUrl: `${EPAPER}/25.jpg`,
    highlights: ["HMDA approved layout", "14% projected appreciation", "NRI POA registration"],
  },
];

export const US_CITIES = [
  "Bay Area",
  "San Jose",
  "Fremont",
  "Seattle",
  "Dallas",
  "Austin",
  "Chicago",
  "New Jersey",
  "Other",
];

export const BUDGETS = ["Under $250K", "$250K – $500K", "$500K – $1M", "$1M – $2M", "$2M+"];

export const TARGET_MARKETS = [
  "Neopolis / Kokapet",
  "Financial District",
  "Gandipet / Mokila",
  "Airport / Pharma City corridor",
  "Amaravati / Vijayawada",
  "Not sure yet",
];
