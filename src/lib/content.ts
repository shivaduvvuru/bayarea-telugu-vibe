export type Category = {
  slug: string;
  te: string;
  en: string;
  children?: Category[];
};

export type CityRegion = {
  key: string;
  en: string;
  te: string;
  cities: Category[];
};

/** The 16 Bay Area cities, grouped by region (South Bay → East Bay → Peninsula → SF). */
export const CITY_REGIONS: CityRegion[] = [
  {
    key: "south-bay",
    en: "South Bay",
    te: "సౌత్ బే",
    cities: [
      { slug: "san-jose", te: "శాన్ జోస్", en: "San Jose" },
      { slug: "santa-clara", te: "శాంటా క్లారా", en: "Santa Clara" },
      { slug: "sunnyvale", te: "సన్నీవేల్", en: "Sunnyvale" },
      { slug: "milpitas", te: "మిల్పిటాస్", en: "Milpitas" },
      { slug: "cupertino", te: "క్యుపర్టినో", en: "Cupertino" },
      { slug: "gilroy", te: "గిల్రాయ్", en: "Gilroy" },
    ],
  },
  {
    key: "east-bay",
    en: "East Bay",
    te: "ఈస్ట్ బే",
    cities: [
      { slug: "fremont", te: "ఫ్రీమాంట్", en: "Fremont" },
      { slug: "union-city", te: "యూనియన్ సిటీ", en: "Union City" },
      { slug: "pleasanton", te: "ప్లెసంటన్", en: "Pleasanton" },
      { slug: "dublin", te: "డబ్లిన్", en: "Dublin" },
      { slug: "livermore", te: "లివర్‌మోర్", en: "Livermore" },
      { slug: "san-ramon", te: "శాన్ రామన్", en: "San Ramon" },
      { slug: "oakland", te: "ఓక్‌లాండ్", en: "Oakland" },
    ],
  },
  {
    key: "peninsula",
    en: "Peninsula",
    te: "పెనిన్సులా",
    cities: [
      { slug: "palo-alto", te: "పాలో ఆల్టో", en: "Palo Alto" },
      { slug: "mountain-view", te: "మౌంటెన్ వ్యూ", en: "Mountain View" },
    ],
  },
  {
    key: "san-francisco",
    en: "San Francisco",
    te: "శాన్ ఫ్రాన్సిస్కో",
    cities: [
      { slug: "san-francisco", te: "శాన్ ఫ్రాన్సిస్కో", en: "San Francisco" },
    ],
  },
];

export const CITY_CATEGORIES: Category[] = CITY_REGIONS.flatMap((r) => r.cities);

/** Section taxonomy for the site. */
export const CATEGORIES: Category[] = [
  {
    slug: "city-news",
    te: "సిటీ న్యూస్",
    en: "City News",
    children: CITY_CATEGORIES,
  },
  {
    slug: "community",
    te: "కమ్యూనిటీ",
    en: "Community",
    children: [
      { slug: "associations", te: "అసోసియేషన్స్", en: "Associations" },
      { slug: "events-community", te: "ఈవెంట్స్", en: "Events" },
      { slug: "groups", te: "గ్రూప్స్", en: "Groups" },
      { slug: "people", te: "పీపుల్", en: "People" },
      { slug: "others", te: "ఇతరాలు", en: "Others" },
    ],
  },
  { slug: "cinema", te: "సినిమా", en: "Cinema" },
  { slug: "political", te: "పొలిటికల్", en: "Political" },
  { slug: "temples", te: "దేవాలయాలు", en: "Temples" },
  { slug: "restaurants", te: "రెస్టారెంట్లు", en: "Restaurants" },
  { slug: "gallery", te: "గ్యాలరీ", en: "Gallery" },
  { slug: "fun-zone", te: "ఫన్ జోన్", en: "Fun Zone" },
  { slug: "readers-column", te: "పాఠకుల కాలమ్", en: "Readers Column" },
  { slug: "classifieds", te: "క్లాసిఫైడ్స్", en: "Classifieds" },
];

export const ALL_CATEGORIES: Category[] = CATEGORIES.flatMap((c) => [
  c,
  ...(c.children ?? []),
]);

export function categoryBySlug(slug: string): Category | undefined {
  return ALL_CATEGORIES.find((c) => c.slug === slug);
}

/** DTO returned by the content server functions. */
export type Article = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  html: string;
  date: string;
  author: string;
  image: string | null;
  category: string;
  categoryName: string;
};

export type DirectoryEntry = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  image: string | null;
  /** Directory category, e.g. "Super Markets". */
  category: string | null;
  /** Other listings for the same business that were collapsed into this one. */
  duplicates?: string[];
};

export function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Categories that count as Bay Area / local reporting (cinema & national excluded). */
export const LOCAL_SLUGS = [
  "city-news",
  ...CITY_CATEGORIES.map((c) => c.slug),
  "community",
  "associations",
  "events-community",
  "groups",
  "people",
  "temples",
  "restaurants",
  "classifieds",
];

export function isLocal(a: Article) {
  return LOCAL_SLUGS.includes(a.category);
}

const TELUGU_RANGE = /[\u0C00-\u0C7F]/;

/** Accurate per-article language label, based on the actual script used. */
export function articleLang(a: Pick<Article, "title" | "excerpt">): "te" | "en" {
  const sample = `${a.title} ${a.excerpt}`;
  const teluguChars = (sample.match(/[\u0C00-\u0C7F]/g) ?? []).length;
  return TELUGU_RANGE.test(sample) && teluguChars > sample.length * 0.15 ? "te" : "en";
}

/**
 * Collapses repetitive announcements from the same organisation
 * (e.g. five Shiva-Vishnu Temple notices) into one grouped entry.
 */
const ORGS = [
  "Shiva-Vishnu Temple",
  "Shiva Vishnu Temple",
  "శివ విష్ణు",
  "Sunnyvale Hindu Temple",
  "Vedic Dharma Samaj",
  "SVCC",
  "TANA",
  "ATA",
  "NATS",
  "BATA",
];

export type ArticleGroup = {
  key: string;
  org: string | null;
  lead: Article;
  rest: Article[];
};

export function groupByOrg(articles: Article[]): ArticleGroup[] {
  const groups: ArticleGroup[] = [];
  const byOrg = new Map<string, ArticleGroup>();

  for (const a of articles) {
    const org = ORGS.find((o) => a.title.toLowerCase().includes(o.toLowerCase())) ?? null;
    if (!org) {
      groups.push({ key: String(a.id), org: null, lead: a, rest: [] });
      continue;
    }
    const existing = byOrg.get(org.toLowerCase());
    if (existing) {
      existing.rest.push(a);
    } else {
      const g: ArticleGroup = { key: org, org, lead: a, rest: [] };
      byOrg.set(org.toLowerCase(), g);
      groups.push(g);
    }
  }
  return groups;
}
