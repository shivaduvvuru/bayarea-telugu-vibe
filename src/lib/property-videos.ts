/**
 * Short project videos for the Property section. Videos live in the database so
 * editors can add, edit and verify them from the desk; only verified rows are
 * ever shown to readers.
 */
export type PropertyVideoStatus = "pending" | "verified" | "rejected";

export interface PropertyVideoRow {
  feature_id: string;
  project: string;
  developer: string | null;
  video_id: string;
  title: string | null;
  note: string | null;
  status: PropertyVideoStatus;
  verified_at: string | null;
  updated_at: string;
}

export interface PropertyVideoWithStats extends PropertyVideoRow {
  clicks: number;
}

/** Accepts a bare id or any common YouTube URL and returns the 11-char id. */
export function parseYouTubeId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /\/embed\/([a-zA-Z0-9_-]{11})/,
    /\/shorts\/([a-zA-Z0-9_-]{11})/,
    /\/live\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = value.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function youtubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** Recommended places to look for a walkthrough when no verified clip exists. */
export function recommendedVideoSources(item: {
  project: string;
  developer: string;
  site?: string;
}): { label: string; hint: string; url: string }[] {
  const q = (extra: string) =>
    encodeURIComponent(`${item.project} ${item.developer} Hyderabad ${extra}`.trim());
  const sources = [
    {
      label: "YouTube — project walkthrough",
      hint: "Developer channels and property vloggers",
      url: `https://www.youtube.com/results?search_query=${q("project video walkthrough")}&sp=EgIYAg%253D%253D`,
    },
    {
      label: "YouTube Shorts — site visit",
      hint: "Quick 60-second tours from the site",
      url: `https://www.youtube.com/results?search_query=${q("site visit shorts")}`,
    },
    {
      label: "Developer channel",
      hint: `Official uploads by ${item.developer}`,
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${item.developer} official channel`)}&sp=EgIQAg%253D%253D`,
    },
  ];
  if (item.site) {
    sources.push({
      label: "Project website",
      hint: "Films and gallery on the developer's own site",
      url: item.site,
    });
  }
  return sources;
}

/* ------------------------------------------------------------------ *
 * Video-tour sourcing checklist
 * ------------------------------------------------------------------ */

export interface VideoSourceStep {
  /** Stable key for checklist state. */
  id: string;
  label: string;
  hint: string;
  url: string;
  /** 0–100 estimate that this particular source carries a usable clip. */
  confidence: number;
}

export interface VideoTourOutlook {
  /** 0–100 estimate that a usable short tour exists somewhere online. */
  score: number;
  label: "Very likely" | "Likely" | "Possible" | "Unlikely";
  reason: string;
  steps: VideoSourceStep[];
}

/**
 * Developers that reliably publish project films / walkthroughs on their own
 * channels, so a search for them is far more likely to land a usable clip.
 */
const PROLIFIC_DEVELOPERS = [
  "my home",
  "aparna",
  "prestige",
  "rajapushpa",
  "dsr",
  "sattva",
  "godrej",
  "sumadhura",
  "asbl",
  "incor",
  "smr",
  "ncc",
  "hallmark",
  "vertex",
  "muppa",
  "vasavi",
  "honer",
  "aurobindo",
  "pbel",
  "manjeera",
  "praneeth",
  "ramky",
  "cybercity",
  "giridhari",
  "anvita",
  "legend",
  "saket",
  "modi",
];

/** Cues in the printed highlight that usually mean a marketing film exists. */
const MARKETED = /(tower|high[- ]?rise|luxury|villa|acres|club|sky|premium|landmark|integrated)/i;

const clamp = (n: number) => Math.max(5, Math.min(96, Math.round(n)));

/**
 * Per-property sourcing checklist: direct, pre-filled search links for each
 * place a walkthrough usually lives, each with an estimated confidence, plus an
 * overall outlook for the project. Deterministic (no randomness) so server and
 * client render the same thing.
 */
export function videoTourOutlook(item: {
  project: string;
  developer: string;
  location?: string;
  note?: string;
  site?: string;
}): VideoTourOutlook {
  const developer = item.developer.trim();
  const project = item.project.replace(/\s*—.*$/, "").trim();
  const city = /hyderabad|kokapet|tellapur|gachibowli|kompally|financial district/i.test(
    `${item.location ?? ""} ${project}`,
  )
    ? "Hyderabad"
    : (item.location?.split(",").pop()?.trim() ?? "Hyderabad");

  const known = PROLIFIC_DEVELOPERS.some((d) => developer.toLowerCase().includes(d));
  const marketed = MARKETED.test(`${item.note ?? ""} ${project}`);
  const hasSite = Boolean(item.site);

  // Base likelihood, nudged by the signals we actually have on the page.
  const base = 44 + (known ? 26 : 0) + (marketed ? 10 : 0) + (hasSite ? 8 : 0) +
    (item.location ? 4 : 0);
  const score = clamp(base);

  const q = (extra: string) =>
    encodeURIComponent(`${project} ${developer} ${city} ${extra}`.trim());

  const steps: VideoSourceStep[] = [
    {
      id: "walkthrough",
      label: "YouTube — project walkthrough",
      hint: "Long-form tours from property channels and vloggers",
      url: `https://www.youtube.com/results?search_query=${q("project walkthrough review")}&sp=EgIYAg%253D%253D`,
      confidence: clamp(score + (marketed ? 6 : 0)),
    },
    {
      id: "shorts",
      label: "YouTube Shorts — site visit",
      hint: "60-second clips shot at the site, best for cards",
      url: `https://www.youtube.com/results?search_query=${q("site visit shorts")}`,
      confidence: clamp(score - 8),
    },
    {
      id: "channel",
      label: `${developer} official channel`,
      hint: known
        ? "Publishes project films regularly — check uploads first"
        : "Smaller channel; check uploads and playlists",
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${developer} official channel ${city}`)}&sp=EgIQAg%253D%253D`,
      confidence: clamp(known ? score + 14 : score - 14),
    },
    {
      id: "drone",
      label: "Drone / construction update",
      hint: "Aerial and progress reels, usually monthly",
      url: `https://www.youtube.com/results?search_query=${q("drone construction update")}`,
      confidence: clamp(score - 16),
    },
  ];

  if (hasSite) {
    steps.push({
      id: "site",
      label: "Project website — films & gallery",
      hint: "Official film is often embedded on the project page",
      url: item.site!,
      confidence: clamp(score + 10),
    });
  }

  const label: VideoTourOutlook["label"] =
    score >= 78 ? "Very likely" : score >= 62 ? "Likely" : score >= 45 ? "Possible" : "Unlikely";

  const reasons = [
    known ? `${developer} posts project films regularly` : `${developer} publishes rarely`,
    marketed ? "actively marketed launch" : "limited marketing cues",
    hasSite ? "official site available" : "no official site on file",
  ];

  return { score, label, reason: reasons.join(" · "), steps };
}
