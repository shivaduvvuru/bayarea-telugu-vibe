/**
 * Shared taxonomy for the Times Bay Area local directory.
 *
 * One list drives everything: the ingest desk's category picker, the Overpass
 * queries used to pull each subcategory from OpenStreetMap, the public search
 * filters, and the smart categorisation of imported rows. A listing keeps one
 * primary category + subcategory and may carry additional categories
 * (`extra_categories`), so an Indian grocery appears under Shopping, Grocery
 * and Indian Grocery at once.
 *
 * `osm` entries are raw Overpass tag selectors. Anything without selectors is a
 * category we fill from public datasets, community submissions or editorial
 * work rather than OSM.
 */

export interface DirectorySubcategory {
  key: string;
  label: string;
  /** Overpass tag selectors, e.g. `["amenity"="restaurant"]`. */
  osm?: string[];
  /** Extra categories every row in this subcategory also belongs to. */
  also?: string[];
  /** Name/description keywords that promote a row into this subcategory. */
  keywords?: string[];
}

export interface DirectoryCategory {
  key: string;
  label: string;
  blurb: string;
  subcategories: DirectorySubcategory[];
}

export const DIRECTORY_TAXONOMY: DirectoryCategory[] = [
  {
    key: "food",
    label: "Food & Dining",
    blurb: "Restaurants, cafes, bakeries, groceries and markets.",
    subcategories: [
      { key: "restaurants", label: "Restaurants", osm: ['["amenity"="restaurant"]'] },
      {
        key: "indian-restaurants",
        label: "Indian restaurants",
        osm: ['["amenity"="restaurant"]["cuisine"~"indian|south_indian|north_indian|punjabi|hyderabadi|andhra",i]'],
        also: ["food:restaurants"],
        keywords: ["indian", "andhra", "hyderabad", "dosa", "biryani", "chaat", "curry"],
      },
      {
        key: "telugu-restaurants",
        label: "Telugu restaurants",
        also: ["food:indian-restaurants", "food:restaurants"],
        keywords: ["telugu", "andhra", "hyderabadi", "godavari", "rayalaseema", "guntur"],
      },
      {
        key: "south-indian",
        label: "South Indian",
        osm: ['["amenity"="restaurant"]["cuisine"~"south_indian|tamil|kerala|udupi",i]'],
        also: ["food:indian-restaurants"],
        keywords: ["udupi", "dosa", "idli", "saravana", "chettinad", "kerala"],
      },
      {
        key: "north-indian",
        label: "North Indian",
        osm: ['["amenity"="restaurant"]["cuisine"~"north_indian|punjabi|mughlai",i]'],
        also: ["food:indian-restaurants"],
        keywords: ["punjabi", "tandoor", "mughlai", "dhaba"],
      },
      {
        key: "vegetarian",
        label: "Vegetarian",
        osm: ['["diet:vegetarian"~"yes|only"]["amenity"~"restaurant|fast_food|cafe"]'],
        keywords: ["vegetarian", "veg ", "pure veg"],
      },
      {
        key: "vegan",
        label: "Vegan",
        osm: ['["diet:vegan"~"yes|only"]["amenity"~"restaurant|fast_food|cafe"]'],
      },
      { key: "cafes", label: "Cafes", osm: ['["amenity"="cafe"]'] },
      { key: "bakeries", label: "Bakeries", osm: ['["shop"="bakery"]'] },
      { key: "fast-food", label: "Fast food", osm: ['["amenity"="fast_food"]'] },
      { key: "food-trucks", label: "Food trucks", osm: ['["amenity"="fast_food"]["cuisine"]["food"="truck"]', '["amenity"="food_court"]'] },
      { key: "catering", label: "Catering", osm: ['["shop"="caterer"]', '["craft"="caterer"]'], keywords: ["catering", "caterer"] },
      { key: "sweets", label: "Sweets & desserts", osm: ['["shop"="confectionery"]', '["shop"="pastry"]', '["amenity"="ice_cream"]'], keywords: ["sweets", "mithai", "laddu"] },
      { key: "grocery", label: "Grocery stores", osm: ['["shop"="supermarket"]', '["shop"="greengrocer"]', '["shop"="convenience"]'], also: ["shopping:specialty"] },
      {
        key: "indian-grocery",
        label: "Indian grocery",
        osm: ['["shop"~"supermarket|convenience|greengrocer"]["origin"~"india",i]'],
        also: ["food:grocery", "shopping:indian-stores"],
        keywords: ["india cash", "indian grocery", "apna bazaar", "namaste plaza", "patel brothers", "new india bazar", "bharat bazar", "spice", "madras groceries", "sabzi"],
      },
      { key: "farmers-markets", label: "Farmers markets", osm: ['["amenity"="marketplace"]'] },
    ],
  },
  {
    key: "religious",
    label: "Religious & Spiritual",
    blurb: "Temples, churches, mosques, gurudwaras and meditation centres.",
    subcategories: [
      {
        key: "hindu-temples",
        label: "Hindu temples",
        osm: ['["amenity"="place_of_worship"]["religion"="hindu"]'],
        keywords: ["temple", "mandir", "devalayam", "venkateswara", "shiva", "balaji"],
      },
      { key: "churches", label: "Churches", osm: ['["amenity"="place_of_worship"]["religion"="christian"]'] },
      { key: "mosques", label: "Mosques", osm: ['["amenity"="place_of_worship"]["religion"="muslim"]'] },
      { key: "gurudwaras", label: "Gurudwaras", osm: ['["amenity"="place_of_worship"]["religion"="sikh"]'] },
      { key: "buddhist", label: "Buddhist centres", osm: ['["amenity"="place_of_worship"]["religion"="buddhist"]'] },
      { key: "jain", label: "Jain centres", osm: ['["amenity"="place_of_worship"]["religion"="jain"]'] },
      { key: "spiritual-orgs", label: "Spiritual organisations", osm: ['["amenity"="place_of_worship"]["religion"~"multifaith|spiritualist|other"]'] },
      { key: "meditation", label: "Meditation centres", keywords: ["meditation", "vipassana", "art of living", "brahma kumaris", "chinmaya", "isha"] },
    ],
  },
  {
    key: "health",
    label: "Health & Wellness",
    blurb: "Doctors, clinics, pharmacies, yoga, fitness and senior care.",
    subcategories: [
      { key: "doctors", label: "Doctors", osm: ['["amenity"="doctors"]', '["healthcare"="doctor"]'] },
      { key: "dentists", label: "Dentists", osm: ['["amenity"="dentist"]', '["healthcare"="dentist"]'] },
      { key: "pediatricians", label: "Pediatricians", osm: ['["healthcare:speciality"~"paediatrics",i]'], keywords: ["pediatric", "children's health"] },
      { key: "specialists", label: "Specialists", osm: ['["healthcare"="specialist"]', '["healthcare"="centre"]'] },
      { key: "urgent-care", label: "Urgent care", osm: ['["healthcare"="urgent_care"]', '["amenity"="clinic"]'] },
      { key: "hospitals", label: "Hospitals", osm: ['["amenity"="hospital"]'] },
      { key: "pharmacies", label: "Pharmacies", osm: ['["amenity"="pharmacy"]'] },
      { key: "physical-therapy", label: "Physical therapy", osm: ['["healthcare"="physiotherapist"]'] },
      { key: "chiropractors", label: "Chiropractors", osm: ['["healthcare"="chiropractor"]'] },
      { key: "ayurveda", label: "Ayurveda", osm: ['["healthcare:speciality"~"ayurveda",i]'], keywords: ["ayurved", "panchakarma"] },
      { key: "yoga", label: "Yoga", osm: ['["leisure"="fitness_centre"]["sport"="yoga"]'], keywords: ["yoga"] },
      { key: "fitness", label: "Fitness centres", osm: ['["leisure"="fitness_centre"]'] },
      { key: "senior-care", label: "Senior care", osm: ['["social_facility"~"nursing_home|group_home"]', '["amenity"="social_facility"]["social_facility:for"="senior"]'] },
      { key: "assisted-living", label: "Assisted living", osm: ['["social_facility"="assisted_living"]'] },
      { key: "home-health", label: "Home health", keywords: ["home health", "home care"] },
      { key: "mental-wellness", label: "Mental wellness", osm: ['["healthcare"="psychotherapist"]', '["healthcare:speciality"~"psychiatry",i]'] },
    ],
  },
  {
    key: "professional",
    label: "Professional Services",
    blurb: "CPAs, attorneys, advisors, agents and consultants.",
    subcategories: [
      { key: "cpas", label: "CPAs & tax", osm: ['["office"="accountant"]', '["office"="tax_advisor"]'], keywords: ["cpa", "tax", "accounting"] },
      { key: "financial-advisors", label: "Financial advisors", osm: ['["office"="financial_advisor"]', '["office"="financial"]'] },
      { key: "attorneys", label: "Attorneys", osm: ['["office"="lawyer"]'] },
      { key: "immigration-attorneys", label: "Immigration attorneys", osm: ['["office"="lawyer"]["lawyer"="immigration"]'], also: ["professional:attorneys"], keywords: ["immigration", "h-1b", "green card", "visa"] },
      { key: "real-estate-agents", label: "Real estate agents", osm: ['["office"="estate_agent"]'], also: ["realestate:realtors"] },
      { key: "mortgage", label: "Mortgage brokers", osm: ['["office"="mortgage_broker"]'], keywords: ["mortgage", "home loan"] },
      { key: "insurance", label: "Insurance agents", osm: ['["office"="insurance"]'] },
      { key: "it-consultants", label: "IT consultants", osm: ['["office"="it"]', '["office"="consulting"]["consulting"="it"]'] },
      { key: "consultants", label: "Business consultants", osm: ['["office"="consulting"]'] },
    ],
  },
  {
    key: "home",
    label: "Home Services",
    blurb: "Contractors, trades, cleaning, pest control and solar.",
    subcategories: [
      { key: "contractors", label: "Contractors", osm: ['["craft"="builder"]', '["office"="construction_company"]'] },
      { key: "plumbers", label: "Plumbers", osm: ['["craft"="plumber"]'] },
      { key: "electricians", label: "Electricians", osm: ['["craft"="electrician"]'] },
      { key: "hvac", label: "HVAC", osm: ['["craft"="hvac"]'] },
      { key: "roofing", label: "Roofing", osm: ['["craft"="roofer"]'] },
      { key: "pest-control", label: "Pest & rodent control", osm: ['["craft"="pest_control"]'], keywords: ["pest", "rodent", "termite"] },
      { key: "landscaping", label: "Landscaping & gardening", osm: ['["craft"="gardener"]', '["shop"="garden_centre"]'] },
      { key: "cleaning", label: "Cleaning", osm: ['["shop"="dry_cleaning"]', '["shop"="laundry"]', '["craft"="cleaning"]'] },
      { key: "handyman", label: "Handyman", keywords: ["handyman", "home repair"] },
      { key: "appliance-repair", label: "Appliance repair", osm: ['["shop"="appliance"]', '["craft"="electronics_repair"]'] },
      { key: "painting", label: "Painting", osm: ['["craft"="painter"]'] },
      { key: "flooring", label: "Flooring", osm: ['["shop"="flooring"]', '["craft"="floorer"]'] },
      { key: "solar", label: "Solar", osm: ['["craft"="photovoltaic"]', '["shop"="solar"]'] },
      { key: "security", label: "Security systems", osm: ['["shop"="security"]', '["craft"="locksmith"]'] },
    ],
  },
  {
    key: "auto",
    label: "Automotive",
    blurb: "Repair, tires, car wash, EV charging and dealers.",
    subcategories: [
      { key: "auto-repair", label: "Auto repair", osm: ['["shop"="car_repair"]'] },
      { key: "body-shops", label: "Body shops", osm: ['["shop"="car_repair"]["service:vehicle:body_repair"="yes"]'] },
      { key: "tires", label: "Tire shops", osm: ['["shop"="tyres"]'] },
      { key: "car-wash", label: "Car wash", osm: ['["amenity"="car_wash"]'] },
      { key: "ev-charging", label: "EV charging", osm: ['["amenity"="charging_station"]'] },
      { key: "dealers", label: "Car dealers", osm: ['["shop"="car"]'] },
      { key: "rentals", label: "Rental cars", osm: ['["amenity"="car_rental"]'] },
      { key: "towing", label: "Towing", keywords: ["towing", "tow service"] },
    ],
  },
  {
    key: "shopping",
    label: "Shopping",
    blurb: "Clothing, jewellery, electronics, furniture and gifts.",
    subcategories: [
      { key: "indian-stores", label: "Indian stores", keywords: ["india", "indian", "saree", "sari", "desi", "bollywood"] },
      { key: "clothing", label: "Clothing", osm: ['["shop"="clothes"]', '["shop"="boutique"]'] },
      { key: "jewelry", label: "Jewellery", osm: ['["shop"="jewelry"]'] },
      { key: "electronics", label: "Electronics", osm: ['["shop"="electronics"]', '["shop"="mobile_phone"]', '["shop"="computer"]'] },
      { key: "furniture", label: "Furniture", osm: ['["shop"="furniture"]'] },
      { key: "home-decor", label: "Home decor", osm: ['["shop"="interior_decoration"]', '["shop"="houseware"]'] },
      { key: "florists", label: "Florists", osm: ['["shop"="florist"]'] },
      { key: "gifts", label: "Gifts", osm: ['["shop"="gift"]'] },
      { key: "specialty", label: "Specialty stores", osm: ['["shop"="variety_store"]', '["shop"="department_store"]', '["shop"="mall"]'] },
    ],
  },
  {
    key: "education",
    label: "Education",
    blurb: "Schools, tutoring, test prep, arts and language classes.",
    subcategories: [
      { key: "schools", label: "Schools", osm: ['["amenity"="school"]'] },
      { key: "preschools", label: "Preschools", osm: ['["amenity"="kindergarten"]'] },
      { key: "daycare", label: "Daycare", osm: ['["amenity"="childcare"]'], also: ["kids:childcare"] },
      { key: "tutoring", label: "Tutoring", osm: ['["amenity"="prep_school"]', '["office"="educational_institution"]'], keywords: ["tutoring", "learning center", "kumon", "mathnasium"] },
      { key: "test-prep", label: "SAT / ACT prep", keywords: ["sat prep", "act prep", "test prep", "princeton review"] },
      { key: "coding", label: "Coding classes", keywords: ["coding", "robotics", "stem academy"] },
      { key: "music-schools", label: "Music schools", osm: ['["amenity"="music_school"]'] },
      { key: "dance-schools", label: "Dance schools", osm: ['["amenity"="dancing_school"]', '["leisure"="dance"]'], keywords: ["kuchipudi", "bharatanatyam", "dance academy"] },
      { key: "telugu-schools", label: "Telugu schools", keywords: ["telugu school", "telugu class", "manabadi", "silicon andhra"] },
      { key: "language-schools", label: "Language schools", osm: ['["amenity"="language_school"]'] },
      { key: "universities", label: "Universities", osm: ['["amenity"="university"]'] },
      { key: "colleges", label: "Community colleges", osm: ['["amenity"="college"]'] },
    ],
  },
  {
    key: "kids",
    label: "Kids & Family",
    blurb: "Play areas, parks, camps, sports and childcare.",
    subcategories: [
      { key: "play-areas", label: "Indoor play areas", osm: ['["leisure"="indoor_play"]', '["leisure"="trampoline_park"]'] },
      { key: "parks", label: "Parks", osm: ['["leisure"="park"]'] },
      { key: "playgrounds", label: "Playgrounds", osm: ['["leisure"="playground"]'] },
      { key: "birthday-venues", label: "Birthday venues", keywords: ["party", "birthday", "fun center"] },
      { key: "summer-camps", label: "Summer camps", keywords: ["summer camp", "day camp"] },
      { key: "sports-coaching", label: "Sports coaching", osm: ['["leisure"="sports_centre"]'] },
      { key: "swimming", label: "Swimming", osm: ['["leisure"="swimming_pool"]', '["sport"="swimming"]'] },
      { key: "martial-arts", label: "Martial arts", osm: ['["sport"~"martial_arts|karate|taekwondo"]'] },
      { key: "childcare", label: "Childcare", osm: ['["amenity"="childcare"]'] },
    ],
  },
  {
    key: "entertainment",
    label: "Entertainment",
    blurb: "Cinemas, performing arts, museums and recreation.",
    subcategories: [
      { key: "movie-theaters", label: "Movie theatres", osm: ['["amenity"="cinema"]'] },
      { key: "indian-cinemas", label: "Indian cinemas", also: ["entertainment:movie-theaters"], keywords: ["india", "bollywood", "telugu", "tollywood"] },
      { key: "performing-arts", label: "Performing arts", osm: ['["amenity"="theatre"]'] },
      { key: "museums", label: "Museums", osm: ['["tourism"="museum"]', '["tourism"="gallery"]'] },
      { key: "live-music", label: "Live music", osm: ['["amenity"="nightclub"]', '["amenity"="music_venue"]'] },
      { key: "bowling", label: "Bowling", osm: ['["leisure"="bowling_alley"]'] },
      { key: "arcades", label: "Arcades", osm: ['["leisure"="amusement_arcade"]'] },
      { key: "escape-rooms", label: "Escape rooms", osm: ['["leisure"="escape_game"]'] },
      { key: "recreation-centers", label: "Recreation centres", osm: ['["leisure"="sports_centre"]', '["amenity"="community_centre"]["community_centre"="recreation"]'] },
    ],
  },
  {
    key: "community",
    label: "Community",
    blurb: "Associations, nonprofits, libraries and community centres.",
    subcategories: [
      { key: "telugu-associations", label: "Telugu associations", keywords: ["telugu", "bata", "tana", "nats", "atta", "silicon andhra"] },
      { key: "indian-associations", label: "Indian associations", keywords: ["indian association", "india community", "fia", "iaba"] },
      { key: "cultural-orgs", label: "Cultural organisations", osm: ['["office"="association"]["association"="cultural"]'] },
      { key: "nonprofits", label: "Nonprofits", osm: ['["office"="ngo"]', '["office"="charity"]', '["office"="association"]'] },
      { key: "community-centers", label: "Community centres", osm: ['["amenity"="community_centre"]'] },
      { key: "libraries", label: "Libraries", osm: ['["amenity"="library"]'], also: ["government:libraries"] },
      { key: "senior-groups", label: "Senior groups", osm: ['["amenity"="social_centre"]["social_centre:for"="senior"]'], keywords: ["senior center", "senior club"] },
      { key: "womens-orgs", label: "Women's organisations", keywords: ["women", "mahila", "shakti"] },
      { key: "student-orgs", label: "Student organisations", keywords: ["student association", "student union"] },
    ],
  },
  {
    key: "events",
    label: "Events & Venues",
    blurb: "Banquet halls, wedding venues, planners and vendors.",
    subcategories: [
      { key: "banquet-halls", label: "Banquet halls", osm: ['["amenity"="events_venue"]'], keywords: ["banquet", "hall"] },
      { key: "wedding-venues", label: "Wedding venues", keywords: ["wedding", "kalyana", "mandapam"] },
      { key: "convention-centers", label: "Convention centres", osm: ['["amenity"="conference_centre"]'] },
      { key: "community-halls", label: "Community halls", osm: ['["amenity"="community_centre"]["community_centre"="hall"]'] },
      { key: "auditoriums", label: "Auditoriums", osm: ['["amenity"="theatre"]["theatre:type"="auditorium"]'] },
      { key: "event-planners", label: "Event planners", osm: ['["office"="event_management"]', '["shop"="event_planning"]'] },
      { key: "photographers", label: "Photographers", osm: ['["craft"="photographer"]', '["shop"="photo"]'] },
      { key: "djs", label: "DJs & sound", keywords: ["dj ", "sound & light", "entertainment services"] },
      { key: "decorators", label: "Decorators", osm: ['["craft"="upholsterer"]'], keywords: ["decor", "decorators", "mandap"] },
    ],
  },
  {
    key: "realestate",
    label: "Real Estate",
    blurb: "Realtors, property managers, apartments and builders.",
    subcategories: [
      { key: "realtors", label: "Realtors", osm: ['["office"="estate_agent"]'] },
      { key: "property-managers", label: "Property managers", osm: ['["office"="property_management"]'] },
      { key: "apartments", label: "Apartments", osm: ['["building"="apartments"]["name"]'] },
      { key: "senior-housing", label: "Senior housing", osm: ['["social_facility"="assisted_living"]'] },
      { key: "builders", label: "Builders & new construction", osm: ['["office"="construction_company"]'] },
      { key: "mortgage-services", label: "Mortgage services", osm: ['["office"="mortgage_broker"]'] },
      { key: "home-inspectors", label: "Home inspectors", keywords: ["home inspection", "inspector"] },
      { key: "title-escrow", label: "Title & escrow", keywords: ["title company", "escrow"] },
    ],
  },
  {
    key: "travel",
    label: "Travel",
    blurb: "Travel agencies, hotels, rentals and transport.",
    subcategories: [
      { key: "travel-agencies", label: "Travel agencies", osm: ['["shop"="travel_agency"]'] },
      { key: "hotels", label: "Hotels", osm: ['["tourism"="hotel"]'] },
      { key: "motels", label: "Motels", osm: ['["tourism"="motel"]'] },
      { key: "vacation-rentals", label: "Vacation rentals", osm: ['["tourism"="guest_house"]', '["tourism"="apartment"]'] },
      { key: "airports", label: "Airports", osm: ['["aeroway"="aerodrome"]["name"]'] },
      { key: "taxi", label: "Taxi & ride services", osm: ['["amenity"="taxi"]'] },
      { key: "bus", label: "Bus", osm: ['["amenity"="bus_station"]'] },
      { key: "train", label: "Train & transit", osm: ['["railway"="station"]["name"]'] },
      { key: "tours", label: "Tours", osm: ['["tourism"="attraction"]["name"]'] },
    ],
  },
  {
    key: "government",
    label: "Government & Civic",
    blurb: "City and county offices, safety, DMV, transit and parks.",
    subcategories: [
      { key: "city-offices", label: "City offices", osm: ['["amenity"="townhall"]'] },
      { key: "county-offices", label: "County offices", osm: ['["office"="government"]'] },
      { key: "libraries", label: "Libraries", osm: ['["amenity"="library"]'] },
      { key: "police", label: "Police stations", osm: ['["amenity"="police"]'] },
      { key: "fire", label: "Fire stations", osm: ['["amenity"="fire_station"]'] },
      { key: "dmv", label: "DMV", osm: ['["office"="government"]["government"="transportation"]'], keywords: ["dmv", "motor vehicles"] },
      { key: "post-offices", label: "Post offices", osm: ['["amenity"="post_office"]'] },
      { key: "parks-rec", label: "Parks & recreation", osm: ['["leisure"="park"]["operator:type"="public"]'] },
      { key: "transit", label: "Public transit", osm: ['["public_transport"="station"]["name"]'] },
    ],
  },
];

export const CATEGORY_KEYS = DIRECTORY_TAXONOMY.map((c) => c.key);

export function categoryOf(key: string): DirectoryCategory | null {
  return DIRECTORY_TAXONOMY.find((c) => c.key === key) ?? null;
}

export function subcategoriesFor(categoryKey: string): DirectorySubcategory[] {
  return categoryOf(categoryKey)?.subcategories ?? [];
}

/** "food:indian-grocery" -> readable "Food & Dining · Indian grocery". */
export function labelForPath(path: string): string {
  const [cat, sub] = path.split(":");
  const category = cat ? categoryOf(cat) : null;
  if (!category) return path;
  const subcategory = sub ? category.subcategories.find((s) => s.key === sub) : null;
  return subcategory ? `${category.label} · ${subcategory.label}` : category.label;
}

export function subcategoryLabel(categoryKey: string, subKey: string | null | undefined): string | null {
  if (!subKey) return null;
  return subcategoriesFor(categoryKey).find((s) => s.key === subKey)?.label ?? null;
}

/** Every subcategory that can be pulled from OpenStreetMap. */
export function osmSubcategories(categoryKeys?: string[]): {
  category: DirectoryCategory;
  sub: DirectorySubcategory;
}[] {
  return DIRECTORY_TAXONOMY.filter((c) => !categoryKeys?.length || categoryKeys.includes(c.key))
    .flatMap((category) => category.subcategories.map((sub) => ({ category, sub })))
    .filter(({ sub }) => (sub.osm?.length ?? 0) > 0);
}

/* ---------------------- community intelligence layer ---------------------- */

/**
 * Telugu/Indian community relevance. Deliberately conservative: matched only on
 * business-published text (names, self-描 descriptions, cuisine tags) — never on
 * a person's name or any inferred ethnicity.
 */
export const COMMUNITY_TAGS = [
  "Indian cuisine",
  "Indian grocery",
  "Telugu services",
  "Indian wedding services",
  "Immigration services",
  "Indian tax & CPA",
  "Indian cultural services",
] as const;

const TAG_RULES: { tag: string; terms: string[] }[] = [
  { tag: "Indian cuisine", terms: ["indian", "south indian", "north indian", "punjabi", "dosa", "biryani", "chaat", "tandoor", "curry"] },
  { tag: "Indian grocery", terms: ["indian grocery", "india cash", "apna bazaar", "namaste plaza", "patel brothers", "bharat bazar", "new india bazar", "madras groceries"] },
  { tag: "Telugu services", terms: ["telugu", "andhra", "hyderabadi", "tollywood", "manabadi", "kuchipudi"] },
  { tag: "Indian wedding services", terms: ["mandap", "kalyana", "indian wedding", "sangeet", "mehndi"] },
  { tag: "Immigration services", terms: ["immigration", "h-1b", "h1b", "green card", "visa services"] },
  { tag: "Indian tax & CPA", terms: ["nri tax", "india tax", "indian cpa"] },
  { tag: "Indian cultural services", terms: ["bharatanatyam", "carnatic", "hindustani", "indian classical", "bollywood dance"] },
];

/** Community tags implied by published business text. Empty when nothing matches. */
export function communityTagsFor(...parts: (string | null | undefined)[]): string[] {
  const hay = ` ${parts.filter(Boolean).join(" ").toLowerCase().replace(/\s+/g, " ")} `;
  const tags = TAG_RULES.filter((r) => r.terms.some((t) => hay.includes(t))).map((r) => r.tag);
  return [...new Set(tags)];
}

/**
 * Extra categories a listing also belongs to: the subcategory's declared
 * `also` paths plus any sibling subcategory whose keywords match the text.
 */
export function extraCategoriesFor(
  category: DirectoryCategory,
  sub: DirectorySubcategory,
  text: string,
): string[] {
  const hay = ` ${text.toLowerCase().replace(/\s+/g, " ")} `;
  const matches = new Set<string>(sub.also ?? []);
  for (const other of DIRECTORY_TAXONOMY) {
    for (const candidate of other.subcategories) {
      if (candidate.key === sub.key && other.key === category.key) continue;
      if (candidate.keywords?.some((k) => hay.includes(k))) {
        matches.add(`${other.key}:${candidate.key}`);
        for (const extra of candidate.also ?? []) matches.add(extra);
      }
    }
  }
  matches.delete(`${category.key}:${sub.key}`);
  return [...matches];
}
