export type ReviewStatus = "Pending" | "Approved" | "Rejected" | "Flagged";
export type VerificationTier = "Standard" | "VIP Gold" | "VIP Platinum";

export type MemberProfile = {
  id: string;
  name: string;
  age: number;
  relationship_status: string;
  occupation: string;
  location: string;
  bio: string;
  profile_image: string;
  review_status: ReviewStatus;
  verification_tier: VerificationTier;
  tags: string[];
  joined: string;
  id_verified: boolean;
  photo_verified: boolean;
};

export const MEMBER_PROFILES: MemberProfile[] = [
  {
    id: "USR-001",
    name: "Elena Rostova",
    age: 28,
    relationship_status: "Single",
    occupation: "Fashion PR Director",
    location: "New York, NY",
    bio: "High-fashion enthusiast, rooftop jazz lover, and luxury brand strategist.",
    profile_image:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1200&q=80",
    review_status: "Pending",
    verification_tier: "VIP Gold",
    tags: ["Fashion", "Jazz", "Fine dining"],
    joined: "2026-08-02",
    id_verified: true,
    photo_verified: false,
  },
  {
    id: "USR-002",
    name: "Chloe Vance",
    age: 31,
    relationship_status: "Single",
    occupation: "Interior Architect",
    location: "Miami, FL",
    bio: "Designing minimalist coastal villas. Passionate about contemporary art and weekend sailing.",
    profile_image:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1200&q=80",
    review_status: "Pending",
    verification_tier: "VIP Platinum",
    tags: ["Architecture", "Sailing", "Modern art"],
    joined: "2026-07-28",
    id_verified: true,
    photo_verified: true,
  },
  {
    id: "USR-003",
    name: "Aria Montgomery",
    age: 26,
    relationship_status: "Single",
    occupation: "Creative Producer",
    location: "Los Angeles, CA",
    bio: "Film set director by week, culinary traveler by weekend. Seeking curated connections.",
    profile_image:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=1200&q=80",
    review_status: "Approved",
    verification_tier: "Standard",
    tags: ["Film", "Travel", "Culinary"],
    joined: "2026-06-11",
    id_verified: true,
    photo_verified: true,
  },
  {
    id: "USR-004",
    name: "Isabella Cruz",
    age: 29,
    relationship_status: "Single",
    occupation: "Private Wealth Advisor",
    location: "San Francisco, CA",
    bio: "Numbers by day, Napa cabernet by night. Marathon runner and opera subscriber.",
    profile_image:
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=1200&q=80",
    review_status: "Pending",
    verification_tier: "VIP Gold",
    tags: ["Finance", "Running", "Opera"],
    joined: "2026-08-09",
    id_verified: false,
    photo_verified: true,
  },
  {
    id: "USR-005",
    name: "Nadia Farrow",
    age: 33,
    relationship_status: "Single",
    occupation: "Gallery Owner",
    location: "Chicago, IL",
    bio: "Curating emerging photography. Collector of vintage Leicas and quiet Sunday mornings.",
    profile_image:
      "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=1200&q=80",
    review_status: "Flagged",
    verification_tier: "VIP Platinum",
    tags: ["Photography", "Collecting", "Wine"],
    joined: "2026-05-30",
    id_verified: true,
    photo_verified: false,
  },
  {
    id: "USR-006",
    name: "Sofia Lindqvist",
    age: 27,
    relationship_status: "Single",
    occupation: "Luxury Travel Curator",
    location: "Austin, TX",
    bio: "Booking private islands for a living. Yoga at sunrise, vinyl at midnight.",
    profile_image:
      "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=1200&q=80",
    review_status: "Approved",
    verification_tier: "VIP Gold",
    tags: ["Travel", "Yoga", "Vinyl"],
    joined: "2026-07-04",
    id_verified: true,
    photo_verified: true,
  },
  {
    id: "USR-007",
    name: "Camille Beaumont",
    age: 30,
    relationship_status: "Single",
    occupation: "Sommelier & Restaurateur",
    location: "Seattle, WA",
    bio: "Second-generation restaurateur. Burgundy purist with a soft spot for street food.",
    profile_image:
      "https://images.unsplash.com/photo-1516726817505-f5ed825624d8?w=1200&q=80",
    review_status: "Rejected",
    verification_tier: "Standard",
    tags: ["Wine", "Hospitality", "Cycling"],
    joined: "2026-04-19",
    id_verified: false,
    photo_verified: false,
  },
  {
    id: "USR-008",
    name: "Priya Raghavan",
    age: 32,
    relationship_status: "Single",
    occupation: "Biotech Founder",
    location: "Boston, MA",
    bio: "Building diagnostics that matter. Classical dancer, chess club regular, espresso snob.",
    profile_image:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=1200&q=80",
    review_status: "Pending",
    verification_tier: "VIP Platinum",
    tags: ["Biotech", "Dance", "Chess"],
    joined: "2026-08-14",
    id_verified: true,
    photo_verified: true,
  },
];
