export type ReviewStatus = "Pending" | "Approved" | "Rejected" | "Flagged";
export type VerificationTier = "Standard" | "VIP Gold" | "VIP Platinum";
export type Region = "US" | "India" | "Korea" | "Japan" | "China";

/** A curated female glamour / celebrity feature item awaiting editorial review. */
export type GlamourProfile = {
  id: string;
  name: string;
  region: Region;
  /** Entertainment industry label, e.g. "Hollywood", "Tollywood", "K-Drama". */
  industry: string;
  /** Profession band, e.g. "Lead Actress", "Character Artist". */
  profession: string;
  /** Notable works / credits used as editorial context. */
  notable_works: string[];
  /** Image style of the curated frame. */
  image_style:
    | "Solo portrait"
    | "Red carpet"
    | "High-fashion editorial"
    | "Photoshoot"
    | "Media gallery";
  /** Curated high-resolution glamour image (single subject only). */
  profile_image: string;
  review_status: ReviewStatus;
  verification_tier: VerificationTier;
  tags: string[];
  /** ISO date the frame was curated into the desk. */
  curated: string;
  /** Verified as a single subject in frame (no groups, couples or crowds). */
  solo_verified: boolean;
  /** Media rights / source credit cleared. */
  rights_cleared: boolean;
  source: string;
};

export const REGION_LABEL: Record<Region, string> = {
  US: "United States",
  India: "India",
  Korea: "South Korea",
  Japan: "Japan",
  China: "China",
};

export const GLAMOUR_PROFILES: GlamourProfile[] = [
  {
    id: "GLM-001",
    name: "Ava Sinclair",
    region: "US",
    industry: "Hollywood",
    profession: "Lead Actress",
    notable_works: ["Midnight Harbor", "The Long Ascent"],
    image_style: "Red carpet",
    profile_image:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1400&q=80",
    review_status: "Pending",
    verification_tier: "VIP Gold",
    tags: ["Red carpet", "Awards season", "Couture"],
    curated: "2026-08-18",
    solo_verified: true,
    rights_cleared: true,
    source: "Entertainment media gallery",
  },
  {
    id: "GLM-002",
    name: "Meera Rajan",
    region: "India",
    industry: "Tollywood",
    profession: "Lead Actress",
    notable_works: ["Veyi Kanulu", "Rathnam"],
    image_style: "High-fashion editorial",
    profile_image:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=1400&q=80",
    review_status: "Pending",
    verification_tier: "VIP Platinum",
    tags: ["Editorial", "Telugu cinema", "Designer wear"],
    curated: "2026-08-19",
    solo_verified: true,
    rights_cleared: true,
    source: "Film publicity still",
  },
  {
    id: "GLM-003",
    name: "Han Seo-yeon",
    region: "Korea",
    industry: "K-Drama",
    profession: "Lead Actress",
    notable_works: ["Winter Letters", "Seoul After Dark"],
    image_style: "Photoshoot",
    profile_image:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1400&q=80",
    review_status: "Approved",
    verification_tier: "VIP Gold",
    tags: ["K-Drama", "Beauty campaign", "Studio"],
    curated: "2026-08-14",
    solo_verified: true,
    rights_cleared: true,
    source: "Studio press kit",
  },
  {
    id: "GLM-004",
    name: "Aiko Tanaka",
    region: "Japan",
    industry: "J-Drama",
    profession: "Character Artist",
    notable_works: ["Kyoto Rain", "The Quiet Ward"],
    image_style: "Solo portrait",
    profile_image:
      "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=1400&q=80",
    review_status: "Pending",
    verification_tier: "Standard",
    tags: ["Portrait", "Character role", "Monochrome"],
    curated: "2026-08-17",
    solo_verified: true,
    rights_cleared: false,
    source: "Entertainment media gallery",
  },
  {
    id: "GLM-005",
    name: "Liu Wenxin",
    region: "China",
    industry: "C-Drama",
    profession: "Lead Actress",
    notable_works: ["Palace of Cranes", "Neon Provinces"],
    image_style: "Media gallery",
    profile_image:
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=1400&q=80",
    review_status: "Flagged",
    verification_tier: "VIP Platinum",
    tags: ["C-Drama", "Period drama", "Gala"],
    curated: "2026-08-16",
    solo_verified: false,
    rights_cleared: true,
    source: "Festival media wall",
  },
  {
    id: "GLM-006",
    name: "Ananya Kapoor",
    region: "India",
    industry: "Bollywood",
    profession: "Lead Actress",
    notable_works: ["Dil Ke Raaste", "Bombay Velvet Nights"],
    image_style: "Red carpet",
    profile_image:
      "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=1400&q=80",
    review_status: "Approved",
    verification_tier: "VIP Gold",
    tags: ["Bollywood", "Premiere", "Couture"],
    curated: "2026-08-12",
    solo_verified: true,
    rights_cleared: true,
    source: "Premiere media gallery",
  },
  {
    id: "GLM-007",
    name: "Divya Menon",
    region: "India",
    industry: "Mollywood",
    profession: "Character Artist",
    notable_works: ["Kayal", "Onam Diaries"],
    image_style: "Photoshoot",
    profile_image:
      "https://images.unsplash.com/photo-1516726817505-f5ed825624d8?w=1400&q=80",
    review_status: "Rejected",
    verification_tier: "Standard",
    tags: ["Malayalam cinema", "Studio", "Traditional"],
    curated: "2026-08-10",
    solo_verified: false,
    rights_cleared: false,
    source: "Entertainment media gallery",
  },
  {
    id: "GLM-008",
    name: "Nila Karthik",
    region: "India",
    industry: "Kollywood",
    profession: "Lead Actress",
    notable_works: ["Vaanam Vazhi", "Chennai Express Lane"],
    image_style: "High-fashion editorial",
    profile_image:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=1400&q=80",
    review_status: "Pending",
    verification_tier: "VIP Gold",
    tags: ["Tamil cinema", "Editorial", "High fashion"],
    curated: "2026-08-19",
    solo_verified: true,
    rights_cleared: true,
    source: "Magazine editorial",
  },
  {
    id: "GLM-009",
    name: "Keerthi Gowda",
    region: "India",
    industry: "Sandalwood",
    profession: "Lead Actress",
    notable_works: ["Mysuru Monsoon", "Kaveri"],
    image_style: "Solo portrait",
    profile_image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=1400&q=80",
    review_status: "Pending",
    verification_tier: "Standard",
    tags: ["Kannada cinema", "Portrait", "Natural light"],
    curated: "2026-08-18",
    solo_verified: true,
    rights_cleared: true,
    source: "Film publicity still",
  },
  {
    id: "GLM-010",
    name: "Scarlett Vaughn",
    region: "US",
    industry: "Hollywood",
    profession: "Character Artist",
    notable_works: ["Ember County", "The Understudy"],
    image_style: "Media gallery",
    profile_image:
      "https://images.unsplash.com/photo-1513379733131-47fc74b45fc7?w=1400&q=80",
    review_status: "Approved",
    verification_tier: "VIP Platinum",
    tags: ["Hollywood", "Festival", "Press line"],
    curated: "2026-08-15",
    solo_verified: true,
    rights_cleared: true,
    source: "Festival media wall",
  },
  {
    id: "GLM-011",
    name: "Park Ji-woo",
    region: "Korea",
    industry: "Korean Cinema",
    profession: "Lead Actress",
    notable_works: ["Tidal", "The Glass House"],
    image_style: "High-fashion editorial",
    profile_image:
      "https://images.unsplash.com/photo-1546961329-78bef0414d7c?w=1400&q=80",
    review_status: "Pending",
    verification_tier: "VIP Gold",
    tags: ["Korean cinema", "Editorial", "Minimal"],
    curated: "2026-08-19",
    solo_verified: true,
    rights_cleared: true,
    source: "Magazine editorial",
  },
  {
    id: "GLM-012",
    name: "Zhang Yiran",
    region: "China",
    industry: "Chinese Cinema",
    profession: "Lead Actress",
    notable_works: ["Silk Road Echo", "Shanghai Sonata"],
    image_style: "Photoshoot",
    profile_image:
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=1400&q=80",
    review_status: "Pending",
    verification_tier: "VIP Platinum",
    tags: ["Chinese cinema", "Studio", "Gown"],
    curated: "2026-08-19",
    solo_verified: true,
    rights_cleared: true,
    source: "Studio press kit",
  },
];
