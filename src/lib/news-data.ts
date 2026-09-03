export type EventItem = {
  id: string;
  title: string;
  /** Local start time, ISO-like without timezone: "2026-08-08T10:00" */
  start: string;
  /** Optional local end time in the same format. */
  end?: string;
  venue: string;
  address: string;
  city: string;
  organiser: string;
  free: boolean;
  cost?: string;
  registerUrl?: string;
  /** Filter facets: family, students, music, culture, spiritual, professional, sports. */
  tags?: string[];
  /** Set when the listing has been confirmed with the organiser. */
  verified: boolean;
  sponsored?: boolean;
};

/**
 * Community calendar. Every entry is flagged `verified` only after the
 * organiser confirms date, venue and ticketing — unverified rows render
 * with a "Details being confirmed" note instead of a Register button.
 */
export const EVENTS: EventItem[] = [
  {
    id: "telugu-literary-evening",
    title: "Telugu Literary Evening",
    start: "2026-08-08T18:30",
    end: "2026-08-08T21:00",
    venue: "Fremont Main Library",
    address: "2400 Stevenson Blvd, Fremont, CA 94538",
    city: "Fremont",
    organiser: "Bay Area Sahiti",
    free: true,
    tags: ["culture", "students"],
    verified: true,
  },
  {
    id: "community-health-camp",
    title: "Free Community Health Camp",
    start: "2026-08-09T09:00",
    end: "2026-08-09T14:00",
    venue: "India Community Center",
    address: "525 Los Coches St, Milpitas, CA 95035",
    city: "Milpitas",
    organiser: "Bay Area Doctors Forum",
    free: true,
    tags: ["family", "professional"],
    verified: true,
  },
  {
    id: "kuchipudi-festival",
    title: "Kuchipudi Festival — Day 1",
    start: "2026-08-15T17:00",
    end: "2026-08-15T20:30",
    venue: "Zellerbach Hall",
    address: "101 Zellerbach Hall, Berkeley, CA 94720",
    city: "Berkeley",
    organiser: "Silicon Andhra",
    free: false,
    cost: "$25 – $60",
    registerUrl: "https://www.eventbrite.com/",
    tags: ["culture", "music", "family"],
    verified: true,
    sponsored: true,
  },
  {
    id: "cricket-league-finals",
    title: "Telugu Cricket League Finals",
    start: "2026-08-22T09:00",
    end: "2026-08-22T16:00",
    venue: "Fair Oaks Park",
    address: "540 N Fair Oaks Ave, Sunnyvale, CA 94085",
    city: "Sunnyvale",
    organiser: "Bay Area Sports Club",
    free: true,
    tags: ["sports", "family"],
    verified: true,
  },
  {
    id: "vinayaka-chavithi",
    title: "Vinayaka Chavithi Celebrations",
    start: "2026-09-14T08:00",
    end: "2026-09-14T20:00",
    venue: "Shiva-Vishnu Temple",
    address: "1232 Arrowhead Ave, Livermore, CA 94551",
    city: "Livermore",
    organiser: "Hindu Community & Cultural Center",
    free: true,
    tags: ["spiritual", "family", "culture"],
    verified: true,
  },
  {
    id: "bathukamma",
    title: "Bathukamma Sambaralu",
    start: "2026-10-17T11:00",
    end: "2026-10-17T17:00",
    venue: "Santa Clara Convention Center",
    address: "5001 Great America Pkwy, Santa Clara, CA 95054",
    city: "Santa Clara",
    organiser: "Bay Area Telangana Association",
    free: false,
    cost: "$15",
    registerUrl: "https://www.eventbrite.com/",
    tags: ["culture", "music", "family"],
    verified: false,
  },
  {
    id: "deepavali-mela",
    title: "Deepavali Mela",
    start: "2026-11-07T12:00",
    end: "2026-11-07T21:00",
    venue: "San Jose Civic",
    address: "135 W San Carlos St, San Jose, CA 95113",
    city: "San Jose",
    organiser: "Bay Area Community Association",
    free: false,
    cost: "$20",
    registerUrl: "https://www.eventbrite.com/",
    tags: ["culture", "family", "music"],
    verified: false,
  },
];

export function eventDate(e: EventItem) {
  const d = new Date(e.start);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Events still ahead of now, soonest first. */
export function upcomingEvents(now = new Date()) {
  return EVENTS.filter((e) => {
    const d = eventDate(e);
    return d ? d.getTime() >= now.getTime() - 86_400_000 : false;
  }).sort((a, b) => a.start.localeCompare(b.start));
}

/** Events falling in the coming Friday–Sunday window. */
export function weekendEvents(now = new Date()) {
  const day = now.getDay();
  const toFriday = (5 - day + 7) % 7;
  const friday = new Date(now);
  friday.setDate(now.getDate() + toFriday);
  friday.setHours(0, 0, 0, 0);
  const monday = new Date(friday);
  monday.setDate(friday.getDate() + 3);
  return upcomingEvents(now).filter((e) => {
    const d = eventDate(e)!;
    return d >= friday && d < monday;
  });
}
