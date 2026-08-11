/**
 * Verified Bay Area temple directory.
 *
 * Every record here was supplied/confirmed by the newsroom. Fields we could not
 * verify (phone, hours, photos, events) are intentionally left out rather than
 * guessed — the UI omits any section without data.
 */
import { CITY_REGIONS } from "@/lib/content";

export type TempleRegion = "South Bay" | "East Bay" | "Peninsula" | "San Francisco";

export type ListingStatus =
  | "Draft"
  | "Pending Review"
  | "Published"
  | "Needs Reverification"
  | "Archived";

export type Temple = {
  id: string;
  slug: string;
  name: string;
  alternate_names: string[];
  region: TempleRegion;
  /** Configured city the temple physically sits in. Null for "near" listings. */
  city: string | null;
  /** For listings just outside a configured city (e.g. San Martin near Gilroy). */
  nearby_city: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  temple_type: string;
  traditions: string[];
  deities: string[];
  languages: string[];
  description: string | null;
  phone: string | null;
  website: string;
  image: string | null;
  opening_hours: string | null;
  /** Page we scrape announcements from, when the temple publishes them. */
  event_source: string | null;
  /** Other locations run by the same organisation. */
  other_locations: { label: string; address?: string; website?: string }[];
  verified: boolean;
  last_verified_at: string;
  listing_status: ListingStatus;
  claimed_by: string | null;
  featured: boolean;
  created_at: string;
  updated_at: string;
};

const STAMP = "2026-08-04";

function temple(t: Partial<Temple> & Pick<Temple, "slug" | "name" | "region" | "address" | "website" | "temple_type">): Temple {
  return {
    id: t.slug,
    alternate_names: [],
    city: null,
    nearby_city: null,
    latitude: null,
    longitude: null,
    traditions: [],
    deities: [],
    languages: [],
    description: null,
    phone: null,
    image: null,
    opening_hours: null,
    event_source: null,
    other_locations: [],
    verified: true,
    last_verified_at: STAMP,
    listing_status: "Published",
    claimed_by: null,
    featured: false,
    created_at: STAMP,
    updated_at: STAMP,
    ...t,
  } as Temple;
}

export const TEMPLES: Temple[] = [
  // ---------------- South Bay ----------------
  temple({
    slug: "balaji-matha-temple-san-jose",
    name: "Balaji Matha & Temple",
    region: "South Bay",
    city: "San Jose",
    address: "5004 N First St, San Jose, CA 95002",
    website: "https://balajitemple.net/",
    event_source: "https://balajitemple.net/",
    temple_type: "Hindu temple",
    deities: ["Balaji", "Venkateswara"],
    traditions: ["Puja"],
    featured: true,
  }),
  temple({
    slug: "radha-krishna-temple-bay-area",
    name: "Radha Krishna Temple of the Bay Area",
    region: "South Bay",
    city: "San Jose",
    address: "4411 Hyland Ave, San Jose, CA 95127",
    website: "https://rktbayarea.org/",
    event_source: "https://rktbayarea.org/",
    temple_type: "Hindu temple",
    deities: ["Radha", "Krishna", "Shiva"],
    traditions: ["Satsang"],
  }),
  temple({
    slug: "shri-krishna-vrundavana-san-jose",
    name: "Shri Krishna Vrundavana",
    region: "South Bay",
    city: "San Jose",
    address: "43 Sunol St, San Jose, CA 95126",
    website: "https://skvtemple.org/",
    temple_type: "Hindu temple",
    deities: ["Krishna"],
    traditions: ["Udupi", "Madhwa"],
  }),
  temple({
    slug: "sri-lakshmi-ganapathi-temple-vvgc-san-jose",
    name: "Sri Lakshmi Ganapathi Temple – VVGC",
    alternate_names: ["VVGC San Jose"],
    region: "South Bay",
    city: "San Jose",
    address: "32 Rancho Dr, Suite B, San Jose, CA 95111",
    website: "https://vvgc.org/san-jose-temple",
    temple_type: "Hindu temple",
    deities: ["Ganapathi"],
    traditions: ["Sanatana Dharma", "Puja"],
  }),
  temple({
    slug: "shiv-durga-temple-santa-clara",
    name: "Shiv Durga Temple of Bay Area",
    region: "South Bay",
    city: "Santa Clara",
    address: "3550 Flora Vista Ave, Santa Clara, CA 95051",
    website: "https://theshivdurgatemple.org/",
    event_source: "https://theshivdurgatemple.org/",
    temple_type: "Hindu temple",
    deities: ["Durga", "Shiva", "Radha Krishna", "Sai Baba"],
    featured: true,
  }),
  temple({
    slug: "sunnyvale-hindu-temple",
    name: "Sunnyvale Hindu Temple & Community Center",
    region: "South Bay",
    city: "Sunnyvale",
    address: "450 Persian Dr, Sunnyvale, CA 94089",
    website: "https://www.sunnyvale-hindutemple.org/",
    event_source: "https://www.sunnyvale-hindutemple.org/",
    temple_type: "Hindu temple and community center",
    traditions: ["Community", "Puja"],
  }),
  temple({
    slug: "shirdi-sai-darbar-sunnyvale",
    name: "Shirdi Sai Darbar",
    alternate_names: ["Bay Area Hindu Temple"],
    region: "South Bay",
    city: "Sunnyvale",
    address: "255 San Geronimo Way, Sunnyvale, CA 94085",
    website: "https://shirdisaidarbar.org/",
    event_source: "http://shirdisaidarbar.org/",
    temple_type: "Hindu temple",
    deities: ["Shirdi Sai Baba"],
    traditions: ["Darbar", "Bhajans"],
    description:
      "Shirdi Sai Darbar and Bay Area Hindu Temple are the same location, listed once.",
  }),
  temple({
    slug: "veda-satyanarayana-swamy-milpitas",
    name: "VEDA Sri Satyanarayana Swamy Devasthanam",
    alternate_names: ["Silicon Valley Temple"],
    region: "South Bay",
    city: "Milpitas",
    address: "475 Los Coches St, Milpitas, CA 95035",
    website: "https://www.siliconvalleytemple.net/",
    event_source: "https://www.siliconvalleytemple.net/",
    temple_type: "Hindu temple",
    deities: ["Satyanarayana Swamy"],
    traditions: ["VEDA", "Puja"],
    featured: true,
  }),
  temple({
    slug: "shirdi-sai-parivaar-milpitas",
    name: "Shirdi Sai Parivaar",
    region: "South Bay",
    city: "Milpitas",
    address: "1221 California Circle, Milpitas, CA 95035",
    website: "https://shirdisaiparivaar.org/",
    event_source: "https://shirdisaiparivaar.org/",
    temple_type: "Hindu temple",
    deities: ["Shirdi Sai Baba"],
    traditions: ["Bhajans", "Community"],
  }),
  temple({
    slug: "baps-shri-swaminarayan-mandir-milpitas",
    name: "BAPS Shri Swaminarayan Mandir",
    alternate_names: ["BAPS San Jose", "Swaminarayan Mandir San Jose"],
    region: "South Bay",
    city: "Milpitas",
    address: "1430 California Circle, Milpitas, CA 95035",
    website: "https://www.baps.org/SanJose",
    temple_type: "Hindu mandir",
    traditions: ["BAPS", "Swaminarayan"],
    description:
      "BAPS calls this its San Jose mandir; the building itself is in Milpitas, so it is listed under Milpitas.",
  }),
  temple({
    slug: "sri-sharadamba-temple-seva-milpitas",
    name: "Sri Sharadamba Temple – SEVA",
    alternate_names: ["SEVA Milpitas"],
    region: "South Bay",
    city: "Milpitas",
    address: "1633 S Main St, Milpitas, CA 95035",
    website: "https://sharadaseva.org/",
    event_source: "https://sharadaseva.org/events",
    temple_type: "Hindu temple",
    deities: ["Sharadamba", "Saraswathi"],
    traditions: ["Sringeri", "Advaita"],
  }),
  temple({
    slug: "vvgc-san-martin",
    name: "VVGC San Martin",
    region: "South Bay",
    city: null,
    nearby_city: "Gilroy",
    address: "11355 Monterey Hwy, San Martin, CA 95046",
    website: "https://vvgc.org/",
    temple_type: "Hindu temple",
    deities: ["Ganapathi"],
    traditions: ["Sanatana Dharma"],
    description: "Nearest temple to Gilroy — located in San Martin, not inside Gilroy.",
  }),

  // ---------------- East Bay ----------------
  temple({
    slug: "fremont-hindu-temple",
    name: "Fremont Hindu Temple – Vedic Dharma Samaj",
    alternate_names: ["Vedic Dharma Samaj"],
    region: "East Bay",
    city: "Fremont",
    address: "3676 Delaware Dr, Fremont, CA 94538",
    website: "https://fremonttemple.org/",
    event_source: "https://fremonttemple.org/",
    temple_type: "Hindu temple",
    traditions: ["Vedic Dharma Samaj", "Puja", "Community"],
    featured: true,
  }),
  temple({
    slug: "karya-siddhi-hanuman-temple-fremont",
    name: "Karya Siddhi Hanuman Temple",
    region: "East Bay",
    city: "Fremont",
    address: "4300 Hansen Ave, Fremont, CA 94536",
    website: "https://www.sgshanuman.org/",
    event_source: "https://www.sgshanuman.org/",
    temple_type: "Hindu temple",
    deities: ["Hanuman"],
    traditions: ["Datta tradition", "Puja"],
  }),
  temple({
    slug: "sri-siddhi-vinayaka-cultural-center-fremont",
    name: "Sri Siddhi Vinayaka Cultural Center",
    alternate_names: ["SVCC Fremont"],
    region: "East Bay",
    city: "Fremont",
    address: "40155 Blacow Rd, Fremont, CA 94538",
    website: "https://www.svcctemple.org/SVCCTempleFremont/",
    temple_type: "Hindu temple and cultural center",
    deities: ["Ganesha", "Siddhi Vinayaka"],
    traditions: ["Cultural center"],
  }),
  temple({
    slug: "sri-sai-temple-pleasanton",
    name: "Sri Sai Temple",
    region: "East Bay",
    city: "Pleasanton",
    address: "9875 Dublin Canyon Rd, Pleasanton, CA 94552",
    website: "https://www.srisaitemple.org/",
    event_source: "https://www.srisaitemple.org/",
    temple_type: "Hindu temple",
    deities: ["Sai Baba"],
    traditions: ["Puja", "Bhajans"],
  }),
  temple({
    slug: "sree-kamalatmika-devi-temple-pleasanton",
    name: "Sree Kamalatmika Devi Temple",
    region: "East Bay",
    city: "Pleasanton",
    address: "1024 Serpentine Ln, Suite 112, Pleasanton, CA 94566",
    website: "https://kamalatmikadevi.org/",
    temple_type: "Hindu temple",
    deities: ["Kamalatmika Devi"],
    traditions: ["Shakti", "Sri Vidya"],
  }),
  temple({
    slug: "sri-panchamukha-hanuman-temple-dublin",
    name: "Sri Panchamukha Hanuman Temple",
    region: "East Bay",
    city: "Dublin",
    address: "6930 Village Pkwy, Suite C, Dublin, CA 94568",
    website: "https://panchamukhahanuman.org/",
    temple_type: "Hindu temple",
    deities: ["Panchamukha Hanuman"],
    traditions: ["Puja", "Bhajans"],
  }),
  temple({
    slug: "shiva-vishnu-temple-livermore",
    name: "Shiva-Vishnu Temple – Hindu Community and Cultural Center",
    alternate_names: ["HCCC Livermore", "Livermore Temple"],
    region: "East Bay",
    city: "Livermore",
    address: "1232 Arrowhead Ave, Livermore, CA 94551",
    website: "https://livermoretemple.org/",
    event_source: "https://www.livermoretemple.org/calendar",
    temple_type: "Hindu temple and community center",
    deities: ["Shiva", "Vishnu", "Venkateswara"],
    traditions: ["HCCC"],
    description:
      "Hindu Community and Cultural Center is the organisation that runs Shiva-Vishnu Temple — one listing, not two.",
    featured: true,
  }),
  temple({
    slug: "sri-karpaga-ganapathi-temple-san-ramon",
    name: "Sri Karpaga Ganapathi Temple",
    alternate_names: ["Gajananam"],
    region: "East Bay",
    city: "San Ramon",
    address: "1021 Market Pl, Suite B, San Ramon, CA 94583",
    website: "https://www.gajananam.org/",
    temple_type: "Hindu temple",
    deities: ["Ganapathi", "Ganesha"],
    traditions: ["Puja"],
  }),
  temple({
    slug: "sri-datta-sai-temple-san-ramon",
    name: "Sri Datta Sai Temple & Cultural Center",
    region: "East Bay",
    city: "San Ramon",
    address: "1901 San Ramon Valley Blvd, San Ramon, CA 94583",
    website: "https://sridattasaimandir.org/",
    temple_type: "Hindu temple and cultural center",
    deities: ["Datta", "Sai Baba"],
    traditions: ["Cultural center"],
  }),
  temple({
    slug: "bhagavan-nityananda-temple-oakland",
    name: "Bhagavan Nityananda Temple at Siddha Yoga Ashram",
    region: "East Bay",
    city: "Oakland",
    address: "1107 Stanford Ave, Oakland, CA 94608",
    website: "https://syaoakland.org/templemeditation",
    temple_type: "Ashram and meditation temple",
    deities: ["Nityananda"],
    traditions: ["Siddha Yoga", "Meditation", "Ashram"],
  }),

  // ---------------- Peninsula ----------------
  temple({
    slug: "ananda-temple-palo-alto",
    name: "Ananda Temple & Teaching Center",
    region: "Peninsula",
    city: "Palo Alto",
    address: "2171 El Camino Real, Palo Alto, CA 94306",
    website: "https://www.anandapaloalto.org/",
    temple_type: "Yoga, meditation and spiritual center",
    traditions: ["Meditation", "Yoga", "Kriya Yoga", "Teaching center"],
    description:
      "A yoga, meditation and teaching centre rather than a conventional deity temple.",
  }),
  temple({
    slug: "iskcon-silicon-valley-mountain-view",
    name: "ISKCON of Silicon Valley",
    alternate_names: ["ISKCON SV"],
    region: "Peninsula",
    city: "Mountain View",
    address: "1965 Latham St, Mountain View, CA 94040",
    website: "https://iskconsv.com/",
    event_source: "https://iskconsv.com/",
    temple_type: "Hindu temple",
    deities: ["Krishna", "Radha"],
    traditions: ["ISKCON", "Bhagavad Gita"],
    featured: true,
  }),

  // ---------------- San Francisco ----------------
  temple({
    slug: "vedanta-society-nc-new-temple-sf",
    name: "Vedanta Society of Northern California – New Temple",
    region: "San Francisco",
    city: "San Francisco",
    address: "2323 Vallejo St, San Francisco, CA 94123",
    website: "https://sfvedanta.org/",
    event_source: "https://sfvedanta.org/",
    temple_type: "Vedanta temple and spiritual center",
    traditions: ["Vedanta", "Ramakrishna", "Meditation"],
    other_locations: [
      {
        label: "Old Temple (historic)",
        address: "2963 Webster St, San Francisco, CA 94123",
        website: "https://sfvedanta.org/",
      },
    ],
  }),
];

/** Cities with no verified temple, plus where to send readers instead. */
export const EMPTY_CITY_NOTES: Record<string, { message: string; nearby: string[] }> = {
  Cupertino: {
    message:
      "No verified temple currently listed in Cupertino. Explore nearby temples in Sunnyvale, Santa Clara and San Jose.",
    nearby: ["Sunnyvale", "Santa Clara", "San Jose"],
  },
  Gilroy: {
    message: "No verified temple currently listed in Gilroy.",
    nearby: ["San Jose"],
  },
  "Union City": {
    message:
      "No verified Hindu temple currently listed in Union City. Explore nearby temples in Fremont.",
    nearby: ["Fremont"],
  },
};

export const CITY_SLUGS = CITY_REGIONS.flatMap((r) =>
  r.cities.map((c) => ({ slug: c.slug, en: c.en, te: c.te, region: r.en as TempleRegion })),
);

export const REGION_SLUGS = CITY_REGIONS.map((r) => ({
  slug: r.key,
  en: r.en as TempleRegion,
  te: r.te,
}));

export function templeBySlug(slug: string) {
  return TEMPLES.find((t) => t.slug === slug) ?? null;
}

export function templesInCity(city: string) {
  return TEMPLES.filter((t) => t.city === city);
}

export function templesNearCity(city: string) {
  return TEMPLES.filter((t) => t.nearby_city === city);
}

export function templesInRegion(region: TempleRegion) {
  return TEMPLES.filter((t) => t.region === region);
}

/** Quick-interest filters shown as chips above the results. */
export const INTEREST_FILTERS = [
  { key: "sai-baba", label: "Sai Baba", match: ["sai baba"] },
  { key: "shiva", label: "Shiva", match: ["shiva"] },
  { key: "vishnu", label: "Vishnu", match: ["vishnu", "venkateswara", "balaji", "satyanarayana"] },
  { key: "krishna", label: "Krishna", match: ["krishna", "radha"] },
  { key: "ganesha", label: "Ganesha", match: ["ganesha", "ganapathi", "vinayaka"] },
  { key: "devi", label: "Devi", match: ["devi", "durga", "sharadamba", "saraswathi", "shakti"] },
  { key: "meditation", label: "Meditation", match: ["meditation", "yoga", "vedanta", "ashram"] },
] as const;

export function matchesInterest(t: Temple, key: string) {
  const filter = INTEREST_FILTERS.find((f) => f.key === key);
  if (!filter) return true;
  const hay = [...t.deities, ...t.traditions, t.temple_type, t.name].join(" ").toLowerCase();
  return filter.match.some((m) => hay.includes(m));
}

export function matchesQuery(t: Temple, q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    t.name,
    ...t.alternate_names,
    t.city ?? "",
    t.nearby_city ?? "",
    t.region,
    t.address,
    t.temple_type,
    ...t.deities,
    ...t.traditions,
  ]
    .join(" ")
    .toLowerCase();
  return needle.split(/\s+/).every((w) => hay.includes(w));
}

/** Normalised keys used for duplicate detection on new submissions. */
export function templeFingerprints(t: {
  name: string;
  address?: string | null;
  website?: string | null;
  phone?: string | null;
}) {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/\b(shri|sri|sree|the|of|temple|mandir|hindu|bay area|inc)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const domain = (t.website ?? "").replace(/^https?:\/\/(www\.)?/, "").split("/")[0] ?? "";
  return {
    name: norm(t.name),
    address: norm(t.address ?? ""),
    domain,
    phone: (t.phone ?? "").replace(/\D/g, ""),
  };
}

/** Returns an existing temple that looks like the same organisation. */
export function findDuplicate(candidate: Parameters<typeof templeFingerprints>[0]) {
  const c = templeFingerprints(candidate);
  return (
    TEMPLES.find((t) => {
      const f = templeFingerprints(t);
      return (
        (c.name && f.name === c.name) ||
        (c.address && f.address === c.address) ||
        (c.domain && f.domain === c.domain) ||
        (c.phone && f.phone && f.phone === c.phone)
      );
    }) ?? null
  );
}

export function mapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function directionsUrl(address: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}
