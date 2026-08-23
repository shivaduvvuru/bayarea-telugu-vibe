/**
 * Bay Area geography for the shared local directory.
 *
 * Ingestion runs city by city (Overpass "around" queries), so every covered
 * community needs an approximate centre. Cities are grouped by county so the
 * ingest desk can select "entire Bay Area", one county, or single cities, and
 * so each stored listing carries a county for filtering.
 */

export interface DirectoryCity {
  name: string;
  lat: number;
  lng: number;
  /** Query radius in metres — larger for sprawling cities. */
  radius?: number;
}

export interface DirectoryCounty {
  key: string;
  name: string;
  cities: DirectoryCity[];
}

export const BAY_AREA_COUNTIES: DirectoryCounty[] = [
  {
    key: "santa-clara",
    name: "Santa Clara County",
    cities: [
      { name: "San Jose", lat: 37.3382, lng: -121.8863, radius: 11000 },
      { name: "Santa Clara", lat: 37.3541, lng: -121.9552 },
      { name: "Sunnyvale", lat: 37.3688, lng: -122.0363 },
      { name: "Milpitas", lat: 37.4323, lng: -121.8996 },
      { name: "Cupertino", lat: 37.323, lng: -122.0322 },
      { name: "Mountain View", lat: 37.3861, lng: -122.0839 },
      { name: "Palo Alto", lat: 37.4419, lng: -122.143 },
      { name: "Los Altos", lat: 37.3852, lng: -122.1141 },
      { name: "Campbell", lat: 37.2872, lng: -121.95 },
      { name: "Saratoga", lat: 37.2638, lng: -122.023 },
      { name: "Los Gatos", lat: 37.2358, lng: -121.9624 },
      { name: "Morgan Hill", lat: 37.1305, lng: -121.6544 },
      { name: "Gilroy", lat: 37.0058, lng: -121.5683 },
    ],
  },
  {
    key: "alameda",
    name: "Alameda County",
    cities: [
      { name: "Fremont", lat: 37.5485, lng: -121.9886, radius: 9000 },
      { name: "Newark", lat: 37.5297, lng: -122.0402 },
      { name: "Union City", lat: 37.5934, lng: -122.0438 },
      { name: "Hayward", lat: 37.6688, lng: -122.0808 },
      { name: "San Leandro", lat: 37.7249, lng: -122.1561 },
      { name: "Oakland", lat: 37.8044, lng: -122.2712, radius: 9000 },
      { name: "Alameda", lat: 37.7652, lng: -122.2416 },
      { name: "Berkeley", lat: 37.8715, lng: -122.273 },
      { name: "Emeryville", lat: 37.8313, lng: -122.2852 },
      { name: "Albany", lat: 37.8869, lng: -122.2977 },
      { name: "Castro Valley", lat: 37.6941, lng: -122.0863 },
      { name: "Pleasanton", lat: 37.6624, lng: -121.8747 },
      { name: "Dublin", lat: 37.7022, lng: -121.9358 },
      { name: "Livermore", lat: 37.6819, lng: -121.768 },
    ],
  },
  {
    key: "san-mateo",
    name: "San Mateo County",
    cities: [
      { name: "San Mateo", lat: 37.5629, lng: -122.3255 },
      { name: "Redwood City", lat: 37.4852, lng: -122.2364 },
      { name: "Foster City", lat: 37.5585, lng: -122.2711 },
      { name: "Burlingame", lat: 37.5841, lng: -122.366 },
      { name: "Millbrae", lat: 37.5985, lng: -122.3872 },
      { name: "San Bruno", lat: 37.6305, lng: -122.4111 },
      { name: "South San Francisco", lat: 37.6547, lng: -122.4077 },
      { name: "Daly City", lat: 37.6879, lng: -122.4702 },
      { name: "Menlo Park", lat: 37.4538, lng: -122.1822 },
      { name: "San Carlos", lat: 37.5072, lng: -122.2605 },
      { name: "Belmont", lat: 37.5202, lng: -122.2758 },
      { name: "Pacifica", lat: 37.6138, lng: -122.4869 },
      { name: "Half Moon Bay", lat: 37.4636, lng: -122.4286 },
    ],
  },
  {
    key: "san-francisco",
    name: "San Francisco",
    cities: [
      { name: "San Francisco", lat: 37.7749, lng: -122.4194, radius: 8000 },
      { name: "San Francisco — Sunset", lat: 37.7509, lng: -122.4842, radius: 4000 },
      { name: "San Francisco — Mission", lat: 37.7599, lng: -122.4148, radius: 3500 },
    ],
  },
  {
    key: "contra-costa",
    name: "Contra Costa County",
    cities: [
      { name: "Walnut Creek", lat: 37.9101, lng: -122.0652 },
      { name: "Concord", lat: 37.978, lng: -122.0311 },
      { name: "San Ramon", lat: 37.7799, lng: -121.978 },
      { name: "Danville", lat: 37.8216, lng: -121.9999 },
      { name: "Pleasant Hill", lat: 37.948, lng: -122.0608 },
      { name: "Richmond", lat: 37.9358, lng: -122.3478 },
      { name: "Antioch", lat: 38.0049, lng: -121.8058 },
      { name: "Brentwood", lat: 37.9319, lng: -121.6958 },
      { name: "Martinez", lat: 38.0194, lng: -122.1341 },
      { name: "San Pablo", lat: 37.9622, lng: -122.3455 },
      { name: "Pittsburg", lat: 38.028, lng: -121.8847 },
      { name: "Orinda", lat: 37.8771, lng: -122.1797 },
    ],
  },
  {
    key: "marin",
    name: "Marin County",
    cities: [
      { name: "San Rafael", lat: 37.9735, lng: -122.5311 },
      { name: "Novato", lat: 38.1074, lng: -122.5697 },
      { name: "Mill Valley", lat: 37.906, lng: -122.545 },
      { name: "Sausalito", lat: 37.8591, lng: -122.4853 },
      { name: "Larkspur", lat: 37.9341, lng: -122.5353 },
    ],
  },
  {
    key: "solano",
    name: "Solano County",
    cities: [
      { name: "Vallejo", lat: 38.1041, lng: -122.2566 },
      { name: "Fairfield", lat: 38.2494, lng: -122.0399 },
      { name: "Vacaville", lat: 38.3566, lng: -121.9877 },
      { name: "Benicia", lat: 38.0494, lng: -122.1586 },
      { name: "Suisun City", lat: 38.2382, lng: -122.0402 },
    ],
  },
  {
    key: "sonoma",
    name: "Sonoma County",
    cities: [
      { name: "Santa Rosa", lat: 38.4405, lng: -122.7144 },
      { name: "Petaluma", lat: 38.2324, lng: -122.6367 },
      { name: "Rohnert Park", lat: 38.3396, lng: -122.7011 },
      { name: "Windsor", lat: 38.5471, lng: -122.8164 },
      { name: "Sonoma", lat: 38.2919, lng: -122.458 },
    ],
  },
  {
    key: "napa",
    name: "Napa County",
    cities: [
      { name: "Napa", lat: 38.2975, lng: -122.2869 },
      { name: "American Canyon", lat: 38.1749, lng: -122.2608 },
      { name: "St. Helena", lat: 38.5052, lng: -122.4703 },
    ],
  },
];

export const DIRECTORY_CITIES: DirectoryCity[] = BAY_AREA_COUNTIES.flatMap((c) => c.cities);

export const DIRECTORY_CITY_NAMES: string[] = [
  ...new Set(DIRECTORY_CITIES.map((c) => c.name.split(" — ")[0]!)),
].sort((a, b) => a.localeCompare(b));

const CITY_INDEX = new Map<string, { city: DirectoryCity; county: DirectoryCounty }>();
for (const county of BAY_AREA_COUNTIES) {
  for (const city of county.cities) CITY_INDEX.set(city.name.toLowerCase(), { city, county });
}

export function findCity(name: string) {
  return CITY_INDEX.get(name.trim().toLowerCase()) ?? null;
}

/** County name for a city label, when we know it. */
export function countyOf(city: string | null | undefined): string | null {
  if (!city) return null;
  return findCity(city)?.county.name ?? null;
}

/** Resolves an ingest selection (all / county keys / city names) to city rows. */
export function resolveGeography(options: {
  counties?: string[] | undefined;
  cities?: string[] | undefined;
}): DirectoryCity[] {
  const cities = (options.cities ?? []).map((c) => findCity(c)?.city).filter(Boolean) as DirectoryCity[];
  if (cities.length > 0) return cities;
  const counties = options.counties ?? [];
  if (counties.length > 0) {
    return BAY_AREA_COUNTIES.filter((c) => counties.includes(c.key)).flatMap((c) => c.cities);
  }
  return DIRECTORY_CITIES;
}
