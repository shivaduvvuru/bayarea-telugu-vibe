/**
 * Temple Calendar — shared, client-safe vocabulary and helpers.
 *
 * The Temple Calendar is a filtered view over one master events store
 * (public.temple_events). Nothing here touches the network or the database.
 */

export type TempleEventLevel = "routine" | "special" | "featured";

export type TempleEventDTO = {
  id: string;
  templeSlug: string | null;
  templeName: string;
  city: string | null;
  region: string | null;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  deities: string[];
  eventType: string;
  eventGroup: string;
  level: TempleEventLevel;
  imageUrl: string | null;
  registerUrl: string | null;
  sourceUrl: string | null;
  recurrence: string | null;
  costType: string | null;
  language: string | null;
  organizer: string | null;
  status: string;
  lastVerifiedAt: string;
};

/** Deity tags we can recognise reliably. Order matters: longest match wins. */
export const DEITY_TAGS: { tag: string; test: RegExp }[] = [
  { tag: "Venkateswara", test: /venkateswara|venkateshwara|balaji|srinivasa|tirupati/i },
  { tag: "Shiva", test: /\bshiva\b|shiv\b|rudra|lingam|shivaratri|mahadev/i },
  { tag: "Ganesha", test: /ganesh|ganapathi|ganapati|vinayaka|vighnesh/i },
  { tag: "Hanuman", test: /hanuman|anjaneya|sundarakanda/i },
  { tag: "Krishna", test: /krishna|janmashtami|gokulashtami|radha|bala\s?gopala/i },
  { tag: "Rama", test: /\brama\b|ramanavami|rama navami|sitarama|ramayan/i },
  { tag: "Durga", test: /durga|chandi|mahishasura|navaratri|navratri/i },
  { tag: "Lakshmi", test: /lakshmi|laxmi|varalakshmi|kamalatmika/i },
  { tag: "Saraswati", test: /saraswat|sharada|sharadamba/i },
  { tag: "Murugan", test: /murugan|subramanya|skanda|kartikeya|karthikeya|shashti/i },
  { tag: "Ayyappa", test: /ayyappa|sabarimala|mandala\s?puja/i },
  { tag: "Sai Baba", test: /sai baba|shirdi|saibaba|\bsai\b/i },
  { tag: "Jagannath", test: /jagannath|rath\s?yatra/i },
  { tag: "Devi", test: /\bdevi\b|amman|ambal|parvati|shakti|kamakshi/i },
  { tag: "Navagraha", test: /navagraha|graha\s?shanti/i },
  { tag: "Satyanarayana", test: /satyanarayana|satyanarayan/i },
  { tag: "Vishnu", test: /vishnu|narayana|vaikunta|ekadasi/i },
  { tag: "Datta", test: /\bdatta|dattatreya|guru\s?charitra/i },
];

export const DEITY_OPTIONS = DEITY_TAGS.map((d) => d.tag);

/** Event types grouped for the filter bar. */
export const EVENT_GROUPS: { group: string; label: string; types: string[]; test: RegExp }[] = [
  {
    group: "puja",
    label: "Puja & Seva",
    types: [
      "Puja",
      "Archana",
      "Abhishekam",
      "Homam / Havan",
      "Kalyanam",
      "Satyanarayana Puja",
      "Sahasranamam",
      "Special Puja",
    ],
    test: /puja|pooja|archana|abhishek|homam|havan|yagna|yagya|kalyanam|sahasranam|rudram|laksha|vratam|vratham|aarti|arati|pradosham/i,
  },
  {
    group: "festival",
    label: "Festival",
    types: [
      "Festival",
      "Ugadi",
      "Sri Rama Navami",
      "Janmashtami",
      "Ganesh Chaturthi",
      "Navaratri",
      "Diwali",
      "Shivaratri",
      "Vaikunta Ekadasi",
      "Brahmotsavam",
      "Rathotsavam",
      "Karthika",
      "Sankranti",
      "Holi",
    ],
    test: /festival|utsav|brahmotsav|rathotsav|jayanthi|jayanti|ugadi|navami|janmashtami|chaturthi|navaratri|navratri|diwali|deepavali|shivaratri|sivaratri|ekadasi|karthika|sankranti|pongal|holi|onam|vinayaka chavithi|dussehra|dasara/i,
  },
  {
    group: "spiritual",
    label: "Spiritual",
    types: [
      "Discourse",
      "Pravachanam",
      "Bhajan",
      "Meditation",
      "Satsang",
      "Chanting",
      "Yoga",
    ],
    test: /discourse|pravachan|bhajan|kirtan|meditat|satsang|chant|parayan|yoga|katha|upanyasam|swamiji|guruji/i,
  },
  {
    group: "cultural",
    label: "Cultural",
    types: ["Classical music", "Dance", "Children's program", "Cultural celebration"],
    test: /classical|carnatic|music|dance|kuchipudi|bharatanatyam|concert|cultural|kids|children|youth program/i,
  },
  {
    group: "community",
    label: "Community",
    types: ["Prasadam / Annadanam", "Volunteer", "Fundraiser", "Charity", "Community gathering"],
    test: /annadan|prasadam|food drive|volunteer|fundrais|charity|donation drive|community|seva day|blood drive/i,
  },
];

export const EVENT_GROUP_OPTIONS = EVENT_GROUPS.map((g) => ({ value: g.group, label: g.label }));

/** Programs that are clearly routine daily/weekly services. */
const ROUTINE = /daily|every\s+(day|morning|evening|saturday|sunday|monday|tuesday|wednesday|thursday|friday)|weekly|regular|nitya|routine|abhishekam schedule|aarti timings/i;
/** Programs big enough to surface on the main Events page and homepage. */
const FEATURED =
  /brahmotsav|rathotsav|kumbabhishek|maha\s?kumbh|diwali|deepavali|navaratri|navratri|ugadi|shivaratri|sivaratri|janmashtami|ganesh chaturthi|vinayaka chavithi|rama navami|sankranti|pongal|holi|dussehra|dasara|vaikunta ekadasi|annual|anniversary|swamiji|visiting|festival of|mahotsav/i;

export function classifyLevel(title: string, recurrence?: string | null): TempleEventLevel {
  const text = `${title} ${recurrence ?? ""}`;
  if (FEATURED.test(text)) return "featured";
  if (ROUTINE.test(text)) return "routine";
  return "special";
}

export function detectDeities(text: string): string[] {
  const out: string[] = [];
  for (const d of DEITY_TAGS) if (d.test.test(text) && !out.includes(d.tag)) out.push(d.tag);
  return out.slice(0, 3);
}

export function detectEventGroup(text: string): { group: string; type: string } {
  for (const g of EVENT_GROUPS) {
    if (g.test.test(text)) {
      const type =
        g.types.find((t) => new RegExp(t.split(" ")[0]!, "i").test(text)) ?? g.types[0]!;
      return { group: g.group, type };
    }
  }
  return { group: "puja", type: "Program" };
}

export type DateRangeKey =
  | "upcoming"
  | "today"
  | "tomorrow"
  | "weekend"
  | "7days"
  | "30days"
  | "month";

export const DATE_RANGES: { value: DateRangeKey; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "weekend", label: "This weekend" },
  { value: "7days", label: "Next 7 days" },
  { value: "30days", label: "Next 30 days" },
  { value: "month", label: "This month" },
];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Inclusive from / exclusive to window for a range key. */
export function rangeWindow(key: DateRangeKey, now = new Date()): { from: Date; to: Date | null } {
  const today = startOfDay(now);
  const day = 24 * 60 * 60 * 1000;
  switch (key) {
    case "today":
      return { from: today, to: new Date(today.getTime() + day) };
    case "tomorrow":
      return { from: new Date(today.getTime() + day), to: new Date(today.getTime() + 2 * day) };
    case "weekend": {
      // Friday evening through end of Sunday.
      const dow = today.getDay(); // 0 Sun .. 6 Sat
      const toFriday = (5 - dow + 7) % 7;
      const from = new Date(today.getTime() + toFriday * day);
      return { from: dow === 0 ? today : from, to: new Date(from.getTime() + 3 * day) };
    }
    case "7days":
      return { from: now, to: new Date(today.getTime() + 7 * day) };
    case "30days":
      return { from: now, to: new Date(today.getTime() + 30 * day) };
    case "month":
      return { from: now, to: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
    default:
      return { from: now, to: null };
  }
}

export function matchesSearch(e: TempleEventDTO, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    e.title,
    e.templeName,
    e.city ?? "",
    e.description ?? "",
    e.eventType,
    ...e.deities,
  ]
    .join(" ")
    .toLowerCase();
  return needle.split(/\s+/).every((w) => hay.includes(w));
}

export function formatEventDay(iso: string): { dow: string; date: string } {
  const d = new Date(iso);
  return {
    dow: d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase(),
  };
}

export function formatEventTime(iso: string, allDay: boolean): string {
  if (allDay) return "All day";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
