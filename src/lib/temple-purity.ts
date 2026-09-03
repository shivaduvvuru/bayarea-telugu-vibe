/**
 * Editorial gate for Temple news.
 *
 * Temple coverage must stay religious and sanctified: seva, utsavam, festival
 * and program notices from a temple's own website or another reliable outlet.
 * Celebrity/gossip angles ("actress visits temple") and crime/scandal stories
 * ("assault at temple", "theft of idols") are rejected outright.
 */
import { TEMPLE_SOURCES } from "./temple-sources";

/** Anything sensational, criminal or celebrity-driven is never temple news. */
const BLOCKED =
  /\b(actress|actor|hero(?:ine)?|star|celebrity|glamour|model|bikini|viral|photoshoot|item song|film|movie|cinema|tollywood|bollywood|kollywood|mollywood|sandalwood|ott|web series|dating|affair|divorce|romance|sexual|sex|rape|assault|molest|harass|abuse|obscene|nude|porn|murder|kill(?:ed|ing)?|death|died|suicide|attack(?:ed)?|vandal|desecrat|arrest(?:ed)?|police|fir\b|court|lawsuit|case filed|jail|bail|fraud|scam|cheat|theft|thief|stolen|steal|robbery|loot|smuggl|liquor|drugs?|protest|clash|riot|controvers|politic(?:s|al|ian)|election|minister|mla|mp\b|cm\b|party|betting|gambling)\b/i;

/** Religious substance a temple story must show. */
const RELIGIOUS =
  /\b(puja|pooja|abhishek\w*|archana|homam|havan|yagna|yagya|seva|sevas|utsav\w*|brahmotsav\w*|kalyanam|festival|jayanth?i|vrat\w*|aarti|arati|bhajan|satsang|discourse|pravachan\w*|parayan\w*|sahasranama|rudram|chandi|annadan\w*|prasad\w*|navratri|navaratri|janmashtami|ganesh|vinayaka|chaturthi|shivratri|shivaratri|ekadasi|pradosham|purnima|poornima|amavasya|deepavali|diwali|ugadi|sankranti|upakarma|panchami|shashti|kumbabhishekam|pratishtha|temple hours|timings|priest|acharya|swami|mandir|temple|devotee\w*|spiritual|prayer|darshan\w*|katha|ramayan\w*|bhagavad|gita|veda|vedic|hanuman|lakshmi|venkateswara|balaji|murugan|ayyappa|durga|saraswati|sharada|shiva|vishnu|krishna|rama)\b/i;

function host(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/** Hosts of the registered temple websites. */
const TEMPLE_HOSTS = new Set(
  TEMPLE_SOURCES.flatMap((s) => [host(s.site), ...s.feeds.map((f) => host(f.url))]).filter(Boolean),
);

/** Reliable outlets whose temple/community reporting we accept. */
const RELIABLE_HOSTS = [
  "timesbayarea.com",
  "indiawest.com",
  "newsindiatimes.com",
  "indiacurrents.com",
  "hinduamerican.org",
  "templepurohit.com",
  "tirumala.org",
  "ttdsevaonline.com",
  "mercurynews.com",
  "sfchronicle.com",
  "eastbaytimes.com",
];

function trustedHost(url: string | null | undefined): boolean {
  const h = host(url);
  if (!h) return false;
  if (TEMPLE_HOSTS.has(h)) return true;
  if (RELIABLE_HOSTS.some((r) => h === r || h.endsWith(`.${r}`))) return true;
  // Any temple's own site: hindu/temple/mandir orgs.
  return /(temple|mandir|devalayam|hindutemple|chinmaya|baps|vedanta|jcnc|saiparivaar|shirdisai)/.test(h);
}

/** True when an item is fit to publish as Temple news. */
export function isTempleNewsClean(item: {
  title?: string | null;
  summary?: string | null;
  sourceUrl?: string | null;
}): boolean {
  const text = `${item.title ?? ""} ${item.summary ?? ""}`;
  if (!text.trim()) return false;
  if (BLOCKED.test(text)) return false;
  if (!RELIGIOUS.test(text)) return false;
  return trustedHost(item.sourceUrl);
}
