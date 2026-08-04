/** Shared, client-safe types and constants for the community forums. */

export const FORUM_CATEGORIES = [
  { value: "general", en: "General Talk", te: "సాధారణ చర్చ" },
  { value: "newcomers", en: "New to the Bay Area", te: "కొత్తగా వచ్చినవారు" },
  { value: "housing", en: "Housing & Rentals", te: "ఇల్లు / అద్దె" },
  { value: "jobs", en: "Jobs & Careers", te: "ఉద్యోగాలు" },
  { value: "immigration", en: "Visa & Immigration", te: "వీసా / ఇమ్మిగ్రేషన్" },
  { value: "schools", en: "Schools & Kids", te: "పాఠశాలలు / పిల్లలు" },
  { value: "events", en: "Events & Meetups", te: "ఈవెంట్స్ / మీటప్‌లు" },
  { value: "food", en: "Food & Restaurants", te: "ఆహారం / రెస్టారెంట్లు" },
  { value: "buy-sell", en: "Buy, Sell & Giveaway", te: "కొనుగోలు / అమ్మకం" },
  { value: "temples", en: "Temples & Culture", te: "దేవాలయాలు / సంస్కృతి" },
] as const;

export type ForumCategory = (typeof FORUM_CATEGORIES)[number]["value"];

export function categoryLabel(value: string) {
  return FORUM_CATEGORIES.find((c) => c.value === value) ?? FORUM_CATEGORIES[0];
}

/**
 * Two buckets, exactly as the newsroom asked for them:
 *  - "approved": the AI monitor found nothing to worry about, it is live.
 *  - "review":   held for a human editor before anyone else can see it.
 *  - "rejected": an editor turned it down.
 */
export type ForumStatus = "approved" | "review" | "rejected";

export type ForumThread = {
  id: string;
  category: string;
  title: string;
  body: string;
  city: string | null;
  author_name: string;
  author_id?: string;
  status: string;
  ai_action: string | null;
  ai_reason: string | null;
  ai_labels: string[];
  ai_score: number | null;
  reply_count: number;
  pinned: boolean;
  last_activity_at: string;
  created_at: string;
};

export type ForumReply = {
  id: string;
  thread_id: string;
  body: string;
  author_name: string;
  status: string;
  ai_action: string | null;
  ai_reason: string | null;
  ai_labels: string[];
  created_at: string;
};

export const THREAD_COLUMNS =
  "id, category, title, body, city, author_name, status, ai_action, ai_reason, ai_labels, ai_score, reply_count, pinned, last_activity_at, created_at";

export const REPLY_COLUMNS =
  "id, thread_id, body, author_name, status, ai_action, ai_reason, ai_labels, created_at";