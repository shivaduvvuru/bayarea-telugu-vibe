/**
 * Individual high-rise (skyscraper) property features published in the Telugu
 * Times 23rd Anniversary Special edition. Each entry is one page of that
 * edition, so the reader sees the developer's own artwork exactly as printed.
 *
 * Only skyscraper / tower projects are listed — villa, jewellery, insurance and
 * association pages of the same edition are deliberately left out.
 */
export interface PropertyFeature {
  /** ePaper page file name (also the stable id). */
  id: string;
  project: string;
  developer: string;
  location?: string;
  /** Short printed highlight, when the page carries one. */
  note?: string;
  /** Developer's own site, as printed on the page. */
  site?: string;
  /** YouTube id of a short project video (walkthrough / project film). */
  videoId?: string;
}

export const EPAPER_ANNIVERSARY_URL =
  "https://www.telugutimes.net/epaper/16-31-23rd-anniv-special";

const BASE = "https://www.telugutimes.net/wp-content/uploads/2026/03";

/** Fallback: a YouTube search for readers when no video is on file. */
export function propertyVideoSearchUrl(item: { project: string; developer: string }): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${item.project} ${item.developer} Hyderabad project video`,
  )}`;
}

/** Full-page image for a feature. */
export function propertyImage(id: string): string {
  return `${BASE}/${id}.jpg`;
}

export const PROPERTY_FEATURES: readonly PropertyFeature[] = [
  {
    id: "3-1",
    project: "Skymarq by DSR",
    developer: "DSR Builders",
    location: "Financial District, Hyderabad",
    note: "New-age luxury towers · 4, 7 & 11 BHK",
    site: "https://dsrbuilders.in",
  },
  {
    id: "2-1",
    project: "My Home Udyan — The Park Life",
    developer: "My Home Group",
    location: "Tellapur, Hyderabad",
    note: "2, 2.5, 3 & 4 BHK · 1350–2915 sq.ft. · 24.12 acres",
    site: "https://www.myhomeconstructions.com/my-home-udyan",
  },
  {
    id: "18-1",
    project: "The Triilight",
    developer: "Triilight",
    location: "Kokapet Golden Mile",
    note: "2888–5777 sq.ft. · from ₹3.43 Cr",
    site: "https://www.thetriilight.com",
  },
  {
    id: "19-1",
    project: "Rise with 9",
    developer: "Neopolis / Triilight",
    location: "Neopolis, Kokapet",
    note: "3303–5777 sq.ft. · from ₹3.92 Cr",
    site: "https://www.risewild.com",
  },
  {
    id: "32",
    project: "The Triilight — landmark feature",
    developer: "Triilight",
    location: "Kokapet, Hyderabad",
    site: "https://www.thetriilight.com",
  },
  {
    id: "33",
    project: "Neopolis",
    developer: "Yula Group",
    location: "Neopolis, Hyderabad",
    site: "https://www.yulaconstructions.com",
  },
  {
    id: "12-1",
    project: "ASBL Spectra",
    developer: "ASBL",
    location: "Financial District, Hyderabad",
    site: "https://asblspectra.com",
  },
  {
    id: "13-1",
    project: "Candeur Skyline",
    developer: "Candeur Group",
    location: "Hyderabad",
    site: "https://www.candeurgroup.com",
  },
  {
    id: "14-1",
    project: "Ashvattha",
    developer: "CSR Estates",
    location: "Hyderabad",
    site: "https://www.csrashvattha.com",
  },
  {
    id: "15-1",
    project: "Twins by DSR",
    developer: "DSR Builders",
    location: "Hyderabad",
    site: "https://dsrbuilders.in/twinsbydsr",
  },
  {
    id: "16-2",
    project: "Crystal Garden",
    developer: "Mahaveer Constructions",
    location: "Hyderabad",
    site: "https://mahaveerconstructions.com",
  },
  {
    id: "17-1",
    project: "My Home Udyan",
    developer: "My Home Group",
    location: "Tellapur, Hyderabad",
    site: "https://www.myhomeconstructions.com/my-home-udyan",
  },
  {
    id: "20-1",
    project: "Megaleio",
    developer: "Navanaami",
    location: "Kokapet, Hyderabad",
    site: "https://www.navanaami.com",
  },
  {
    id: "21",
    project: "Poulomi Palazzo",
    developer: "Poulomi Estates",
    location: "Hyderabad",
    site: "https://www.poulomipalazzo.com",
  },
  {
    id: "22",
    project: "Nova by Raghava",
    developer: "Raghava Group",
    location: "Hyderabad",
    site: "https://novabyraghava.world",
  },
  {
    id: "23",
    project: "Casa Lagoona",
    developer: "Rajapushpa Properties",
    location: "Hyderabad",
    site: "https://www.rajapushpa.in",
  },
  {
    id: "24",
    project: "Ramky One Odyssey",
    developer: "Ramky Estates",
    location: "Hyderabad",
    site: "https://ramkyonesymphony.com",
  },
  {
    id: "25",
    project: "Diamond Towers",
    developer: "R-One",
    location: "Hyderabad",
    site: "https://r-one.co.in",
  },
  {
    id: "26",
    project: "Sattva Lakeridge",
    developer: "Sattva Group",
    location: "Neopolis, Kokapet",
    site: "https://sattvalakeridgeneopolis.com",
  },
  {
    id: "27",
    project: "Abbham",
    developer: "Shangrila Infra",
    location: "Hyderabad",
    site: "https://shangrilainfra.com/abbham",
  },
  {
    id: "28",
    project: "IWA",
    developer: "SRIAS Life Spaces",
    location: "Hyderabad",
    site: "https://srias.co.in/iwa",
  },
  {
    id: "29",
    project: "The Marquis",
    developer: "Sri Sreenivasa Infra",
    location: "Hyderabad",
    site: "https://srisreenivasa.com",
  },
  {
    id: "30-1",
    project: "Aurum",
    developer: "Sree Varaaha Group",
    location: "Hyderabad",
    site: "https://sreevaraahagroup.com",
  },
  {
    id: "31",
    project: "The Olympus",
    developer: "Sumadhura Group",
    location: "Hyderabad",
    site: "https://theolympus.in",
  },
  {
    id: "9-1",
    project: "Anvita Ivana",
    developer: "Anvita Group",
    location: "Hyderabad",
    site: "https://anvitagroup.com",
  },
  {
    id: "10-1",
    project: "Aparna Synergy",
    developer: "Aparna Constructions",
    location: "Hyderabad",
    site: "https://aparnagroupprojects.com",
  },
  {
    id: "11-1",
    project: "The Pearl",
    developer: "Auro Realty",
    location: "Hyderabad",
    site: "https://aurorealty.com/residential-projects/the-pearl",
  },
] as const;
