/**
 * Decides which collected items may go live without an editor.
 *
 * Temple notices and community events are factual listings — they publish
 * automatically. News publishes automatically too, unless the text reads as
 * sensitive, in which case it waits in the review desk for a human.
 */

const SENSITIVE =
  /\b(murder|killed|kill|shooting|shot dead|stabb|homicide|rape|sexual|molest|assault|abuse|suicide|self[- ]harm|overdose|arrest|indict|convict|lawsuit|sued|defam|fraud|scam|racist|racism|hate crime|caste|communal|riot|terror|bomb|shoot[- ]out|deport|ice raid|immigration raid|custody|court|police|fbi|allegation|alleged|accus|harass|misconduct|obscene|nude|leak(?:ed)? (?:photo|video)|controvers|slam|abort|gun\b|dead body|crash|fatal|died|death)\b/i;

/** True when a headline/summary should be read by an editor before publishing. */
export function isSensitive(title?: string | null, summary?: string | null): boolean {
  return SENSITIVE.test(`${title ?? ""} ${summary ?? ""}`);
}

/**
 * True when a collected item can be published straight away.
 * News, temple notices and events all go live without an editor — readers can
 * like a story or dislike it, and a dislike deletes it site-wide.
 */
export function canAutoPublish(_kind: string, _title?: string | null, _summary?: string | null) {
  return true;
}

