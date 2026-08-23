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
