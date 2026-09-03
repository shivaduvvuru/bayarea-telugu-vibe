/** Shared community reference data for the Bay Area portal. */

export const COMMUNITY_EMAIL = "contact@timesbayarea.com";

export type Association = {
  name: string;
  short: string;
  url: string;
  blurb: string;
};

/** Order fixed by the editorial team. */
export const ASSOCIATIONS: Association[] = [
  {
    name: "Bay Area Telugu Association",
    short: "BATA",
    url: "https://www.bata.org/",
    blurb: "The oldest Telugu association in the Bay Area, founded by community pioneers.",
  },
  {
    name: "Silicon Andhra",
    short: "Silicon Andhra",
    url: "https://siliconandhra.org/",
    blurb: "Kuchipudi, Telugu language classes, Manabadi and the biennial international conference.",
  },
  {
    name: "TANA Bay Area",
    short: "TANA",
    url: "https://www.tana.org/",
    blurb: "Bay Area chapter of the Telugu Association of North America.",
  },
  {
    name: "ATA Bay Area",
    short: "ATA",
    url: "https://ataworld.org/",
    blurb: "Bay Area chapter of the American Telugu Association.",
  },
  {
    name: "Telangana Development Forum",
    short: "TDF",
    url: "https://www.tdfusa.org/",
    blurb: "Telangana community, cultural and social service initiatives in the Bay Area.",
  },
  {
    name: "NRI TDP, Bay Area",
    short: "NRI TDP",
    url: "https://www.nritdp.com/",
    blurb: "Bay Area unit of the NRI Telugu Desam Party forum.",
  },
  {
    name: "IT Serve Bay Area",
    short: "IT Serve",
    url: "https://itserve.org/",
    blurb: "IT staffing and entrepreneur network chapter serving the Bay Area.",
  },
];

export type TempleInfo = {
  name: string;
  city: string;
  note: string;
};

/** Temples we track for announcements and event calendars. */
export const BAY_AREA_TEMPLES: TempleInfo[] = [
  { name: "Shiva-Vishnu Temple", city: "Livermore", note: "HCCC Livermore — festivals and daily sevas" },
  { name: "Veda Temple", city: "Milpitas", note: "Vedic rituals, homams and calendar events" },
  { name: "Sunnyvale Hindu Temple", city: "Sunnyvale", note: "Weekly bhajans and festival celebrations" },
  { name: "Fremont Hindu Temple", city: "Fremont", note: "Community pujas and cultural programs" },
  { name: "Sai Mandir", city: "Milpitas", note: "Sai bhajans, aarti and annadanam" },
  { name: "Sri Sharadamba Temple (SEVA)", city: "Milpitas", note: "Sharada puja and student blessings" },
];

/** Directory categories in the order requested by the editorial team. */
export const DIRECTORY_CATEGORIES = [
  "Cinema Theatres",
  "Hindu Temples",
  "Restaurants",
  "Super Markets",
  "CPAs",
  "Attorneys",
  "Real Estate Agents",
  "Dental Surgeons / Clinics",
  "Music Teachers",
  "Dance Teachers",
  "Indoor Game Coaches",
  "Outdoor Game Coaches",
  "Basketball Coaches",
  "Photographers / Videographers",
  "Hindu Priests",
];

/** The 16 Bay Area cities used for directory filtering. */
export const DIRECTORY_CITIES = [
  "San Jose",
  "Fremont",
  "Sunnyvale",
  "Milpitas",
  "Santa Clara",
  "Pleasanton",
  "San Ramon",
  "Dublin",
  "Livermore",
  "Union City",
  "San Francisco",
  "Cupertino",
  "Mountain View",
  "Gilroy",
  "Oakland",
  "Palo Alto",
];
