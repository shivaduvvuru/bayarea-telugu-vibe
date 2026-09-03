/** Shared community reference data for the Bay Area portal. */

export const COMMUNITY_EMAIL = "contact@timesbayarea.com";


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
