export type City = { slug: string; en: string; te: string; region: string };

/** The 16 Bay Area cities covered by Lite_BayArea, grouped by region. */
export const CITY_REGIONS: { key: string; en: string; cities: Omit<City, "region">[] }[] = [
  {
    key: "south-bay",
    en: "South Bay",
    cities: [
      { slug: "san-jose", en: "San Jose", te: "శాన్ జోస్" },
      { slug: "santa-clara", en: "Santa Clara", te: "శాంటా క్లారా" },
      { slug: "sunnyvale", en: "Sunnyvale", te: "సన్నీవేల్" },
      { slug: "milpitas", en: "Milpitas", te: "మిల్పిటాస్" },
      { slug: "cupertino", en: "Cupertino", te: "క్యుపర్టినో" },
      { slug: "gilroy", en: "Gilroy", te: "గిల్రాయ్" },
    ],
  },
  {
    key: "east-bay",
    en: "East Bay",
    cities: [
      { slug: "fremont", en: "Fremont", te: "ఫ్రీమాంట్" },
      { slug: "union-city", en: "Union City", te: "యూనియన్ సిటీ" },
      { slug: "pleasanton", en: "Pleasanton", te: "ప్లెసంటన్" },
      { slug: "dublin", en: "Dublin", te: "డబ్లిన్" },
      { slug: "livermore", en: "Livermore", te: "లివర్‌మోర్" },
      { slug: "san-ramon", en: "San Ramon", te: "శాన్ రామన్" },
      { slug: "oakland", en: "Oakland", te: "ఓక్‌లాండ్" },
    ],
  },
  {
    key: "peninsula",
    en: "Peninsula",
    cities: [
      { slug: "palo-alto", en: "Palo Alto", te: "పాలో ఆల్టో" },
      { slug: "mountain-view", en: "Mountain View", te: "మౌంటెన్ వ్యూ" },
    ],
  },
  {
    key: "san-francisco",
    en: "San Francisco",
    cities: [{ slug: "san-francisco", en: "San Francisco", te: "శాన్ ఫ్రాన్సిస్కో" }],
  },
];

export const CITIES: City[] = CITY_REGIONS.flatMap((r) =>
  r.cities.map((c) => ({ ...c, region: r.en })),
);

export const cityBySlug = (slug: string) => CITIES.find((c) => c.slug === slug);
