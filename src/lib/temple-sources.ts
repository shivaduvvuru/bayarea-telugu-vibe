/**
 * Temple announcement sources.
 *
 * These are pulled directly from each temple's own website — no dependency on
 * any external CMS. Adding a temple is a one-line change here.
 */
export type TempleSource = {
  /** Stable id used as a cache key and React key. */
  id: string;
  name: string;
  city: string;
  region: "South Bay" | "East Bay" | "Peninsula" | "San Francisco";
  /** Public homepage, linked from the card. */
  site: string;
  /** Pages/feeds to read announcements from, tried in order. */
  feeds: { url: string; mode: "rss" | "html" }[];
};

export const TEMPLE_SOURCES: TempleSource[] = [
  {
    id: "hccc-livermore",
    name: "Shiva-Vishnu Temple (HCCC)",
    city: "Livermore",
    region: "East Bay",
    site: "https://www.livermoretemple.org/",
    feeds: [
      { url: "https://www.livermoretemple.org/calendar", mode: "html" },
      { url: "https://www.livermoretemple.org/", mode: "html" },
    ],
  },
  {
    id: "sunnyvale-hindu-temple",
    name: "Sunnyvale Hindu Temple",
    city: "Sunnyvale",
    region: "South Bay",
    site: "https://www.sunnyvale-hindutemple.org/",
    feeds: [{ url: "https://www.sunnyvale-hindutemple.org/", mode: "html" }],
  },
  {
    id: "seva-sharadamba",
    name: "Sri Sharadamba Temple (SEVA)",
    city: "Milpitas",
    region: "South Bay",
    site: "https://sharadaseva.org/",
    feeds: [
      { url: "https://sharadaseva.org/events", mode: "html" },
      { url: "https://sharadaseva.org/", mode: "html" },
    ],
  },
  {
    id: "shirdi-sai-parivaar",
    name: "Shirdi Sai Parivaar (Sai Mandir)",
    city: "Milpitas",
    region: "South Bay",
    site: "https://shirdisaiparivaar.org/",
    feeds: [{ url: "https://shirdisaiparivaar.org/", mode: "html" }],
  },
  {
    id: "fremont-hindu-temple",
    name: "Fremont Hindu Temple",
    city: "Fremont",
    region: "East Bay",
    site: "https://fremonttemple.org/",
    feeds: [{ url: "https://fremonttemple.org/", mode: "html" }],
  },
  {
    id: "shirdi-sai-darbar",
    name: "Shirdi Sai Darbar",
    city: "Sunnyvale",
    region: "South Bay",
    site: "http://shirdisaidarbar.org/",
    feeds: [{ url: "http://shirdisaidarbar.org/", mode: "html" }],
  },
  {
    id: "jain-center-sj",
    name: "Jain Center of Northern California",
    city: "Milpitas",
    region: "South Bay",
    site: "https://www.jcnc.org/",
    feeds: [{ url: "https://www.jcnc.org/", mode: "html" }],
  },
  {
    id: "sanatan-dharma-sj",
    name: "Sanatan Dharma Kendra",
    city: "San Jose",
    region: "South Bay",
    site: "https://sanatandharmakendra.org/",
    feeds: [{ url: "https://sanatandharmakendra.org/", mode: "html" }],
  },
  {
    id: "vedic-dharma-samaj",
    name: "Vedic Dharma Samaj (Fremont Hindu Temple)",
    city: "Fremont",
    region: "East Bay",
    site: "https://www.fremonttemple.org/",
    feeds: [{ url: "https://www.fremonttemple.org/events/", mode: "html" }],
  },
  {
    id: "sri-venkateswara-temple-eb",
    name: "Sri Venkateswara Swamy Temple",
    city: "Dublin",
    region: "East Bay",
    site: "https://www.svtemplebayarea.org/",
    feeds: [{ url: "https://www.svtemplebayarea.org/", mode: "html" }],
  },
  {
    id: "chinmaya-sandeepany",
    name: "Chinmaya Mission Sandeepany",
    city: "San Ramon",
    region: "East Bay",
    site: "https://www.chinmaya-sandeepany.org/",
    feeds: [{ url: "https://www.chinmaya-sandeepany.org/", mode: "html" }],
  },
  {
    id: "ganesha-temple-fremont",
    name: "Shree Ganesha Temple",
    city: "Fremont",
    region: "East Bay",
    site: "https://www.ganeshatemple.org/",
    feeds: [{ url: "https://www.ganeshatemple.org/", mode: "html" }],
  },
  {
    id: "chinmaya-san-jose",
    name: "Chinmaya Mission San Jose",
    city: "San Jose",
    region: "South Bay",
    site: "https://www.cmsj.org/",
    feeds: [{ url: "https://www.cmsj.org/", mode: "html" }],
  },
  {
    id: "shiva-murugan-concord",
    name: "Shiva Murugan Temple",
    city: "Concord",
    region: "East Bay",
    site: "https://www.shivamurugan.org/",
    feeds: [{ url: "https://www.shivamurugan.org/", mode: "html" }],
  },
  {
    id: "vedanta-berkeley",
    name: "Vedanta Society of Berkeley",
    city: "Berkeley",
    region: "East Bay",
    site: "https://vedantaberkeley.org/",
    feeds: [{ url: "https://vedantaberkeley.org/", mode: "html" }],
  },
  {
    id: "chinmaya-mission-sf",
    name: "Vedanta Society of Northern California",
    city: "San Francisco",
    region: "San Francisco",
    site: "https://sfvedanta.org/",
    feeds: [{ url: "https://sfvedanta.org/", mode: "html" }],
  },
  {
    id: "hindu-temple-sf",
    name: "Sri Lakshmi Narayan Mandir",
    city: "San Francisco",
    region: "San Francisco",
    site: "https://www.hindutempleofsf.org/",
    feeds: [{ url: "https://www.hindutempleofsf.org/", mode: "html" }],
  },
  {
    id: "sunnyvale-jain-shwetambar",
    name: "Chinmaya Mission Peninsula",
    city: "San Mateo",
    region: "Peninsula",
    site: "https://www.chinmayasanjose.org/",
    feeds: [{ url: "https://www.chinmayasanjose.org/", mode: "html" }],
  },
  {
    id: "shri-swaminarayan-redwood",
    name: "BAPS Shri Swaminarayan Mandir",
    city: "Milpitas",
    region: "South Bay",
    site: "https://www.baps.org/Global-Network/North-America/Milpitas.aspx",
    feeds: [
      { url: "https://www.baps.org/Global-Network/North-America/Milpitas.aspx", mode: "html" },
    ],
  },
];
