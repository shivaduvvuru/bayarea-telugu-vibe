/**
 * Content classification: News vs Event vs FunZone.
 *
 * One underlying item can surface in several places, but it carries a single
 * primary bucket so the homepage does not force everything into "News".
 *
 *   NEWS    — something happened or was announced
 *   EVENT   — something people can attend at a future date/time/place
 *   FUNZONE — something primarily enjoyable to attend, watch, visit or eat
 */

export type PrimaryBucket = "news" | "event" | "funzone";

export type Classification = {
  primary: PrimaryBucket;
  /** Additional sections the item legitimately belongs in. */
  secondary: string[];
  /** Free-form tags (city, subject, organiser). */
  tags: string[];
  /** Human label for the badge shown on cards. */
  label: string;
};

const TEMPLE =
  /\b(temple|mandir|brahmotsavam|puja|pooja|abhishekam|homam|navaratri|navratri|ugadi|diwali|deepavali|ganesh|vinayaka|sankranti|discourse|bhajan|satsang|anniversary celebration)\b/i;
const ASSOCIATION =
  /\b(association|ata|tana|nats|tesla society|sangam|samithi|independence day|republic day|cultural program(?:me)?|charity|fundraiser|networking|convention|conference|sammelanam)\b/i;
const RESTAURANT = /\b(restaurant|cafe|eatery|kitchen|dhaba|buffet|food truck|sweets|tiffin)\b/i;
const FOOD_EVENT =
  /\b(food festival|hyderabadi food|tasting|cook-?off|dj night|comedy night|live music|karaoke|ladies night|brunch special)\b/i;
const FUN =
  /\b(concert|comedy|stand-?up|movie|film screening|show|dance|drama|kids|family|carnival|mela|fair|exhibition|amusement|nightlife|weekend getaway|trek|hike|zoo|museum|garba|dandiya)\b/i;
const FUTURE_EVENT =
  /\b(this weekend|tomorrow|tonight|upcoming|will be held|to be held|announces|invites|registration|tickets|rsvp|schedule[d]? (?:for|on)|on (?:sat|sun|mon|tue|wed|thu|fri)\w*)\b/i;
const PAST_EVENT =
  /\b(attend(?:ed|ees)|thousands|celebrated|concluded|held on|marked|hosted|wrapped up|drew)\b/i;
const BUSINESS = /\b(opens|opening|launch(?:es|ed)?|expands|hiring|funding|acquires|store|branch)\b/i;

const CITIES = [
  "Fremont", "Milpitas", "San Jose", "Sunnyvale", "Santa Clara", "Cupertino",
  "Pleasanton", "Dublin", "San Ramon", "Redwood City", "San Mateo",
  "San Francisco", "Mountain View", "Palo Alto", "Newark", "Union City",
];

export function citiesIn(text: string): string[] {
  const lower = text.toLowerCase();
  return CITIES.filter((c) => lower.includes(c.toLowerCase()));
}

/**
 * Classifies an item from its text plus an optional event date. An explicit
 * future event date always wins: that is the definition of an event.
 */
export function classifyItem(input: {
  title: string;
  summary?: string | null;
  kind?: string | null;
  eventStart?: string | null;
  now?: Date;
}): Classification {
  const now = input.now ?? new Date();
  const text = `${input.title} ${input.summary ?? ""}`;
  const tags = new Set<string>(citiesIn(text));

  const start = input.eventStart ? new Date(input.eventStart) : null;
  const hasFutureDate = !!start && !Number.isNaN(start.getTime()) && start >= now;
  const hasPastDate = !!start && !Number.isNaN(start.getTime()) && start < now;

  const temple = TEMPLE.test(text);
  const association = ASSOCIATION.test(text);
  const restaurant = RESTAURANT.test(text);
  const foodEvent = FOOD_EVENT.test(text);
  const fun = FUN.test(text) || foodEvent;

  if (temple) tags.add("Temple");
  if (association) tags.add("Community");
  if (restaurant) tags.add("Restaurant");

  const secondary = new Set<string>();
  let primary: PrimaryBucket = "news";
  let label = "News";

  const announcesEvent =
    hasFutureDate ||
    (input.kind === "event" && !hasPastDate) ||
    (FUTURE_EVENT.test(text) && !PAST_EVENT.test(text) && (temple || association || fun || foodEvent));

  if (announcesEvent) {
    primary = "event";
    label = temple ? "Temple / Spiritual" : association ? "Community Event" : "Event";
    if (temple) secondary.add("community");
    if (association) secondary.add("community");
    if (fun || foodEvent) secondary.add("funzone");
    if (restaurant || foodEvent) secondary.add("food");
  } else if (fun && !hasPastDate && !BUSINESS.test(text)) {
    primary = "funzone";
    label = "FunZone";
    secondary.add("events");
    if (restaurant || foodEvent) secondary.add("food");
  } else {
    // After the fact, or a plain announcement: community / business news.
    primary = "news";
    if (temple || association) {
      label = "Community";
      secondary.add("community");
      secondary.add("culture");
    } else if (restaurant) {
      label = "Food";
      secondary.add("food");
      secondary.add("business");
    } else if (BUSINESS.test(text)) {
      label = "Business";
      secondary.add("business");
    }
  }

  return { primary, secondary: [...secondary], tags: [...tags], label };
}

/** True while an event is still worth showing under "Happening Soon". */
export function isUpcoming(eventStart: string | null | undefined, now = new Date()): boolean {
  if (!eventStart) return false;
  const start = new Date(eventStart);
  if (Number.isNaN(start.getTime())) return false;
  // An event stays listed through the end of its own day.
  return start.getTime() >= now.getTime() - 12 * 60 * 60 * 1000;
}

/** Chronological bucket label: Today → Tomorrow → This weekend → Coming soon. */
export function whenLabel(eventStart: string, now = new Date()): string {
  const start = new Date(eventStart);
  const days = Math.floor(
    (new Date(start.toDateString()).getTime() - new Date(now.toDateString()).getTime()) /
      (24 * 60 * 60 * 1000),
  );
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  const day = start.getDay();
  if (days <= 6 && (day === 5 || day === 6 || day === 0)) return "This weekend";
  return "Coming soon";
}
