/**
 * Client-safe classifier for Telugu / Indian cinema coverage.
 *
 * Movie stories collected from Tollywood and Bollywood desks used to land in the
 * generic "news" bucket. This files them under the site's Cinema section, and
 * photo-led film stories also surface in Gallery.
 */

export const CINEMA_SLUG = "cinema";

const CINEMA_TEXT =
  /tollywood|bollywood|kollywood|telugu (?:film|movie|cinema|actor|actress|hero|heroine)|hindi (?:film|movie|cinema)|box office|first look|teaser|trailer|movie review|film review|ott release|pre[- ]release (?:event|business)|audio launch|censor|cast(?:ing)? (?:announce|update)|shooting (?:begins|update|wrap)|film ?fare|national film award|\bbiopic\b|సినిమా|చిత్రం|టాలీవుడ్|బాలీవుడ్|హీరో|హీరోయిన్|నటి|నటుడు|ట్రైలర్|టీజర్|ఫస్ట్ లుక్|ఓటీటీ|బాక్సాఫీస్|వెబ్ సిరీస్|రిలీజ్/i;


/** Well-known film-trade publishers whose whole feed is cinema. */
const CINEMA_HOSTS =
  /123telugu|gulte|greatandhra|idlebrain|m9\.news|filmibeat|pinkvilla|bollywoodhungama|cinejosh|telugu360|sacnilk|koimoi|indiaglitz|movietalkies|mirchi9|tupaki|telugustop|ragalahari|cinemaexpress|filmfare|moneycontrol\.com\/entertainment|news18\.com\/photogallery/i;


/** True when a story reads as film / entertainment coverage. */
export function isCinema(
  title: string | null | undefined,
  summary?: string | null,
  sourceUrl?: string | null,
): boolean {
  const text = `${title ?? ""} ${summary ?? ""}`;
  if (CINEMA_TEXT.test(text)) return true;
  return CINEMA_HOSTS.test((sourceUrl ?? "").toLowerCase());
}

/**
 * Gallery is a star picture desk, not a headline feed: it only carries
 * photo-led coverage of Telugu / Hindi / OTT heroines and stars.
 */
const PHOTO_LED =
  /\b(?:photos?|pics?|pictures?|stills?|gallery|galleries|photoshoot|photo shoot|shoot|snaps?|clicks?|looks?|new look|latest look|saree|traditional look|red carpet|ramp walk|magazine cover|cover shoot|poses|stunning|gorgeous|viral (?:photos|pics)|instagram|insta (?:post|story|reel)|social media|reel|selfie|beach (?:look|photos)|bikini|glam(?:orous)? (?:photos|look)|sizzling|dazzling|hot (?:photos|pics|look)|bold look|album)\b|ఫోటోలు|ఫొటోలు|ఫోటో షూట్|స్టిల్స్|గ్యాలరీ|లుక్|చిత్రాలు|షూట్|వైరల్|ఇన్‌స్టా|సోషల్ మీడియా|రీల్స్|సెల్ఫీ/i;

/** Male-subject cues: those photo posts stay in Cinema, not the Gallery. */
const MALE_SUBJECT =
  /\b(?:actor|hero|director|producer|comedian|singer|megastar|power star|young tiger|mass maharaja|natural star|rebel star|superstar (?:rajinikanth|mahesh)|nandamuri|jr\.? ?ntr|ntr|pawan kalyan|allu arjun|mahesh babu|prabhas|ram charan|nani|vijay deverakonda|ravi teja|nithiin|sharwanand|bellamkonda|akhil|varun tej|sai (?:dharam )?tej|naga chaitanya|nagarjuna|balakrishna|chiranjeevi|venkatesh|shah ?rukh|salman|aamir|hrithik|ranbir|ranveer|ajay devgn|akshay|kartik aaryan|vicky kaushal|allu sirish|siddhu|teja sajja|rajinikanth|vijay|dhanush|suriya|yash|rishab shetty)\b|హీరో\b|నటుడు|దర్శకుడు/i;

/** Female star cues, including headline-only names from film desks. */
const FEMALE_SUBJECT =
  /\b(?:actress|heroine|glam(?:our|orous)?|beauty|diva|she\b|her\b|model|samantha|rashmika|pooja hegde|sreeleela|anupama|keerthy suresh|kajal|tamannaah|nabha natesh|krithi shetty|nidhhi agerwal|raashi khanna|rakul|shraddha|katrina|deepika|alia|janhvi|kiara|ananya|tripti dimri|mrunal thakur|sai pallavi|nayanthara|trisha|malavika mohanan|meenakshi chaudhary|payal rajput|faria abdullah|shriya|hansika|regina|ashu reddy|bhagyashri|divi vadthya|priyanka|kriti sanon|tara sutaria|disha patani|urvashi|nora fatehi|avika gor|lavanya|ketika sharma|shivani|apsara rani|ruhani sharma|sanjana|amrutha|preity mukhundhan|kushitha|nuveksha|rashi singh|yukti thareja|neha shetty|anikha|aishwarya|madhuri|nithya menen|niharika)\b|హీరోయిన్|నటి|అందాల|భామ|గ్లామర్|తార|సుందరి/i;

/**
 * True for heroine / female-star photo features that belong in Gallery.
 * Photo posts about male actors are deliberately excluded.
 */
export function isStarGallery(
  title: string | null | undefined,
  summary?: string | null,
  sourceUrl?: string | null,
): boolean {
  const text = `${title ?? ""} ${summary ?? ""}`;
  const url = (sourceUrl ?? "").toLowerCase();
  const photoLed =
    PHOTO_LED.test(text) || /gallery\.|\/gallery\/|\/photos?\/|slideshow/.test(url);
  if (!photoLed) return false;
  if (!FEMALE_SUBJECT.test(text)) return false;
  // Strictly no men in Gallery: any male-subject cue disqualifies the post.
  if (MALE_SUBJECT.test(text)) return false;
  return true;
}



