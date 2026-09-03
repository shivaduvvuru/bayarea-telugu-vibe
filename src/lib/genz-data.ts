/**
 * Gen Z formats. Every entry is explicitly flagged `sample: true` until an
 * editor replaces it with verified, sourced content — the UI renders a
 * "Sample content" chip so nothing unverified reads as reporting.
 */
export type ShortVideo = {
  id: string;
  title: string;
  city: string;
  duration: string;
  poster: string;
  href: string;
  sample: boolean;
};

export type SwipeStory = {
  id: string;
  title: string;
  kicker: string;
  cards: { heading: string; body: string }[];
  sample: boolean;
};

export type Deal = {
  id: string;
  business: string;
  offer: string;
  city: string;
  expires: string;
  sponsored: boolean;
  sample: boolean;
};

export type Voice = {
  id: string;
  name: string;
  role: string;
  quote: string;
  city: string;
  sample: boolean;
};

export type Poll = {
  id: string;
  question: string;
  options: string[];
};

const img = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=720&q=70`;

export const SHORT_VIDEOS: ShortVideo[] = [
  {
    id: "sv-1",
    title: "60 seconds: what changed at Fremont's new Telugu school campus",
    city: "Fremont",
    duration: "0:58",
    poster: img("photo-1503676260728-1c00da094a0b"),
    href: "https://www.youtube.com/@timesbayarea",
    sample: true,
  },
  {
    id: "sv-2",
    title: "Where to find real Godavari-style tiffins in San Jose",
    city: "San Jose",
    duration: "0:47",
    poster: img("photo-1585937421612-70a008356fbe"),
    href: "https://www.youtube.com/@timesbayarea",
    sample: true,
  },
  {
    id: "sv-3",
    title: "Inside the Livermore temple's weekend seva rush",
    city: "Livermore",
    duration: "1:02",
    poster: img("photo-1604608672516-f1b9b1a0a3f9"),
    href: "https://www.youtube.com/@timesbayarea",
    sample: true,
  },
  {
    id: "sv-4",
    title: "H-1B season: three things Bay Area students should do now",
    city: "Santa Clara",
    duration: "0:52",
    poster: img("photo-1524178232363-1fb2b075b655"),
    href: "https://www.youtube.com/@timesbayarea",
    sample: true,
  },
];

export const SWIPE_STORIES: SwipeStory[] = [
  {
    id: "ss-new-to-bay",
    kicker: "New to the Bay",
    title: "Landed in the Bay Area? Your first 30 days, sorted",
    sample: true,
    cards: [
      {
        heading: "Week 1 — paperwork",
        body: "SSN appointment, bank account, phone plan. Book the SSN slot before you look at apartments.",
      },
      {
        heading: "Week 2 — getting around",
        body: "Clipper card for BART and VTA. A car matters more in Fremont and Milpitas than in San Francisco.",
      },
      {
        heading: "Week 3 — groceries and food",
        body: "Namaste Plaza, Apna Bazaar and India Cash & Carry cover most Telugu pantry staples.",
      },
      {
        heading: "Week 4 — find your people",
        body: "Association meetups, temple volunteering and campus Telugu clubs are the fastest way in.",
      },
    ],
  },
  {
    id: "ss-weekend",
    kicker: "What's the Vibe?",
    title: "An Indian weekend in the Bay, from Friday night to Sunday lunch",
    sample: true,
    cards: [
      {
        heading: "Friday",
        body: "Late-night tiffin runs in Sunnyvale and a community film screening in Santa Clara.",
      },
      {
        heading: "Saturday",
        body: "Morning cricket at Fair Oaks Park, evening kuchipudi or a association fundraiser.",
      },
      {
        heading: "Sunday",
        body: "Temple abhishekam in Livermore, then a long Andhra meals lunch in Milpitas.",
      },
    ],
  },
];

export const DEALS: Deal[] = [
  {
    id: "deal-1",
    business: "Sample Andhra Kitchen",
    offer: "15% off weekday lunch thali for students with ID",
    city: "Milpitas",
    expires: "Ongoing",
    sponsored: true,
    sample: true,
  },
  {
    id: "deal-2",
    business: "Sample Tax & Immigration Advisors",
    offer: "Free 20-minute first consultation for new arrivals",
    city: "Santa Clara",
    expires: "Ongoing",
    sponsored: true,
    sample: true,
  },
  {
    id: "deal-3",
    business: "Sample Dance Academy",
    offer: "First kuchipudi trial class free",
    city: "Fremont",
    expires: "Ongoing",
    sponsored: false,
    sample: true,
  },
];

export const VOICES: Voice[] = [
  {
    id: "v-1",
    name: "Sample contributor",
    role: "Graduate student, San Jose State",
    quote:
      "I grew up speaking Telugu at home but never learned to read it. An English-first Bay Area edition finally lets me keep up with community news.",
    city: "San Jose",
    sample: true,
  },
  {
    id: "v-2",
    name: "Sample contributor",
    role: "Software engineer, Fremont",
    quote:
      "The hardest part of moving here was not the job — it was finding a community that felt like home on weekends.",
    city: "Fremont",
    sample: true,
  },
  {
    id: "v-3",
    name: "Sample contributor",
    role: "Parent volunteer, Dublin",
    quote:
      "Our kids want the culture, just delivered the way they consume everything else: short, visual and in English.",
    city: "Dublin",
    sample: true,
  },
];

export const POLL: Poll = {
  id: "poll-weekend",
  question: "What should we cover more of in the Bay Area edition?",
  options: [
    "Local events and festivals",
    "Food and restaurants",
    "Jobs and careers",
    "Student and immigration guides",
  ],
};