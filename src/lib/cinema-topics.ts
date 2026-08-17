/**
 * Client-safe classifier for Indian and Hollywood cinema coverage.
 *
 * Movie stories collected from Tollywood, Bollywood, Kollywood, Mollywood,
 * Sandalwood and Hollywood desks used to land in the generic "news" bucket.
 * This files them under the site's Cinema section, and photo-led film stories
 * also surface in Gallery.
 */

export const CINEMA_SLUG = "cinema";

const CINEMA_TEXT =
  /tollywood|bollywood|kollywood|mollywood|sandalwood|hollywood|telugu (?:film|movie|cinema|actor|actress|hero|heroine)|(?:tamil|malayalam|kannada) (?:film|movie|cinema|actor|actress|hero|heroine)|hindi (?:film|movie|cinema)|box office|first look|teaser|trailer|movie review|film review|ott release|pre[- ]release (?:event|business)|audio launch|censor|cast(?:ing)? (?:announce|update)|shooting (?:begins|update|wrap)|film ?fare|national film award|academy award|oscar|\bbiopic\b|సినిమా|చిత్రం|టాలీవుడ్|బాలీవుడ్|హాలీవుడ్|హీరో|హీరోయిన్|నటి|నటుడు|ట్రైలర్|టీజర్|ఫస్ట్ లుక్|ఓటీటీ|బాక్సాఫీస్|వెబ్ సిరీస్|రిలీజ్|మూవీ|సినిమాలు|టాలీవుడ్/i;


/** Well-known film-trade publishers whose whole feed is cinema. */
const CINEMA_HOSTS =
  /123telugu|gulte|greatandhra|idlebrain|m9\.news|filmibeat|pinkvilla|bollywoodhungama|cinejosh|telugu360|sacnilk|koimoi|indiaglitz|movietalkies|mirchi9|tupaki|telugustop|ragalahari|cinemaexpress|filmfare|moneycontrol\.com\/entertainment|news18\.com\/photogallery|ndtv\.com\/entertainment|ndtvmovies|indiatoday\.in\/movies|indiatoday\.in\/television|etimes|timesofindia\.indiatimes\.com\/entertainment|deccanchronicle\.com\/entertainment|freepressjournal\.in\/entertainment|thehindu\.com\/entertainment|iwmbuzz|bollywoodlife|spotboye|variety|deadline|hollywoodreporter|eonline|pagesix|justjared|tmz|entertainmenttonight|people\.com|vogue|elle|glamour\.com/i;


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
  /\b(?:photos?|pics?|pictures?|stills?|gallery|galleries|photoshoot|photo shoot|photo dump|shoot|snaps?|snapped|clicks?|clicked|spotted|looks?|new look|latest look|saree|traditional look|ethnic look|red carpet|ramp walk|magazine cover|cover shoot|poses|posing|stunning|stuns|stunner|gorgeous|glams? up|charming|mesmeri[sz]|dazzl|radiant|beautiful|cute|viral (?:photos|pics|video)|goes viral|instagram|insta (?:post|story|reel)|social media|reels?|selfie|beach (?:look|photos)|bikini|swimsuit|glam(?:orous)?(?: photos| look)?|sizzl|hot (?:photos|pics|look)|bold look|album|latest clicks|breaks the internet|sets the internet)\b|ఫోటోలు|ఫొటోలు|ఫోటో షూట్|స్టిల్స్|గ్యాలరీ|లుక్|చిత్రాలు|షూట్|వైరల్|ఇన్‌స్టా|సోషల్ మీడియా|రీల్స్|సెల్ఫీ|అందాలు/i;

/** Picture desks / photo sections whose posts are galleries by construction. */
const PHOTO_DESK_URL =
  /gallery\.|\/gallery|\/galleries|\/photos?|\/photo-gallery|\/photostory|photogallery|slideshow|ragalahari|telugustop|sitara|\/web-?stories/i;

/** The photo section has to sit on an entertainment desk, not city/politics. */
const ENTERTAINMENT_URL =
  /entertainment|celeb|movie|cinema|film|bollywood|tollywood|kollywood|hollywood|tv-shows|fashion|lifestyle|beauty/i;

/** Hard news cues — never a glamour picture post, whatever the URL says. */
const NEWSY =
  /\b(?:arrest|police|court|case filed|fir\b|murder|rape|assault|dies|died|death|passes away|obituar|accident|crash|fire|flood|earthquake|protest|election|minister|politic|court order|traffic|weather|covid|scam|fraud|suicide|hospital|verdict|petition|bandh|strike|war|attack|shooting|backlash|slams|controvers|lawsuit|feud|apolog)\b|ట్రాఫిక్|అరెస్ట్|కేసు|మృతి|ప్రమాదం|ఎన్నికల/i;



/** Male-subject cues: those photo posts stay in Cinema, not the Gallery. */
const MALE_SUBJECT =
  /\b(?:actor|hero|director|producer|comedian|singer|megastar|power star|young tiger|mass maharaja|natural star|rebel star|superstar (?:rajinikanth|mahesh)|nandamuri|jr\.? ?ntr|ntr|pawan kalyan|allu arjun|mahesh babu|prabhas|ram charan|nani|vijay deverakonda|ravi teja|nithiin|sharwanand|bellamkonda|akhil|varun tej|sai (?:dharam )?tej|naga chaitanya|nagarjuna|balakrishna|chiranjeevi|venkatesh|shah ?rukh|salman|aamir|hrithik|ranbir|ranveer|ajay devgn|akshay|kartik aaryan|vicky kaushal|allu sirish|siddhu|teja sajja|rajinikanth|vijay|dhanush|suriya|yash|rishab shetty|timothee chalamet|chris evans|ryan reynolds|leonardo dicaprio|brad pitt|tom holland|chris hemsworth|robert downey|johnny depp|matt damon|ben affleck|george clooney|bradley cooper|jake gyllenhaal|andrew garfield|tobey maguire|hugh jackman|henry cavill|jason momoa|idris elba|michael b jordan|chadwick boseman|will smith|denzel washington|morgan freeman|samuel jackson|keanu reeves|jason statham|vin diesel|dwayne johnson|chris pratt|john cena|the rock)\b|హీరో\b|నటుడు|దర్శకుడు/i;

/** Female star cues across Telugu, Hindi, Tamil, Malayalam, Kannada and Hollywood cinema. */
const FEMALE_SUBJECT =
  /\b(?:actress|heroine|glam(?:our|orous)?|beauty|diva|she\b|her\b|model|samantha|rashmika|pooja hegde|sreeleela|anupama|keerthy suresh|kajal|tamannaah|nabha natesh|krithi shetty|nidhhi agerwal|raashi khanna|rakul|shraddha|katrina|deepika|alia|janhvi|kiara|ananya|tripti dimri|mrunal thakur|sai pallavi|nayanthara|trisha|malavika mohanan|meenakshi chaudhary|payal rajput|faria abdullah|shriya|hansika|regina|ashu reddy|bhagyashri|divi vadthya|priyanka|kriti sanon|tara sutaria|disha patani|urvashi|nora fatehi|avika gor|lavanya|ketika sharma|shivani|apsara rani|ruhani sharma|sanjana|amrutha|preity mukhundhan|kushitha|nuveksha|rashi singh|yukti thareja|neha shetty|anikha|aishwarya|madhuri|nithya menen|niharika|aishwarya rajesh|anikha surendran|andrea jeremiah|sri divya|priya bhavani shankar|aparna das|ivana|nikki galrani|amala paul|kalyani priyadarshan|ahaana krishna|ann augustine|anna ben|rajisha vijayan|aparna balamurali|manju warrier|nazriya|parvathy thiruvothu|honey rose|durga krishna|esther anil|saniya iyappan|anaswara rajan|ashika ranganath|rachita ram|rashmika mandanna|shanvi srivastava|radhika kumaraswamy|nidhi subbaiah|milana nagaraj|samyuktha|sanjana anand|reeshma nanaiah|haripriya|amrutha iyengar|kavya shetty|priyanka upendra|mehreen pirzada|pranitha subhash|catherine tresa|ileana d cruz|raasi|latha|ramya krishnan|jayaprada|jayasudha|kanchana|saritha|revathi|srividya|bhanupriya|radha|suhasini|amala|madhavi|silk smitha|emma watson|dakota johnson|alexandra daddario|jennifer connelly|monica bellucci|ki?era knightley|maggie grace|kate upton|shailene woodley|mila kunis|lea seydoux|julianne moore|olga kurylenko|eva green|cobie smulders|gemma arterton|rachel weisz|odette annable|kate beckinsale|elisha cuthbert|anna kendrick|marion cotillard|amy adams|sophie turner|rosamund pike|elle fanning|emilia clarke|chloe grace moretz|amber heard|kate hudson|madhuri dixit|sridevi|juhi chawla|karisma kapoor|rani mukerji|preity zinta|bipasha basu|sushmita sen|lara dutta|esha deol|sonam kapoor|parineeti chopra|yami gautam|kajol|shilpa shetty|malaika arora|jacqueline fernandez|sonakshi sinha|huma qureshi|radhika apte|taapsee pannu|bhumi pednekar|vaani kapoor|kriti kharbanda|pooja bhatt|neha dhupia|evelyn sharma|amy jackson|elli avram|giorgia andriani|krystle dsouza|surbhi jyoti|surbhi chandna|hina khan|jennifer winget|erica fernandes|rubina dilaik|shehnaaz gill|tejasswi prakash|nia sharma|karishma tanna|mouni roy|aditi rao hydari|sobhita dhulipala|wamiqa gabbi|alaya f|sharvari|rasha thadani|khushi kapoor|suhana khan|palak tiwari|shanaya kapoor|nushrratt bharuccha|kubbra sait|shweta tiwari|raveena tandon|bhagyashree|tabu|dia mirza|genelia|asin|nargis fakhri|athiya shetty|sanya malhotra|fatima sana shaikh|banita sandhu|medha shankr|rukmini vasanth|triptii dimri|scarlett johansson|margot robbie|zendaya|jennifer lawrence|emma stone|natalie portman|anne hathaway|gal gadot|charlize theron|angelina jolie|julia roberts|millie bobby brown|florence pugh|ana de armas|sydney sweeney|anya taylor-joy|selena gomez|hailey bieber|kylie jenner|kim kardashian|beyonce|rihanna|taylor swift|ariana grande|lady gaga|dua lipa|billie eilish|megan fox|blake lively|gwyneth paltrow|kate winslet|reese witherspoon|sandra bullock|nicole kidman|penelope cruz|salma hayek|eva longoria|olivia wilde|jessica alba|halle berry|demi moore|drew barrymore|cameron diaz|jennifer aniston|lupita nyong'o|naomi watts|kristen stewart|elizabeth olsen|brie larson|rachel mcadams|anne marie|camila cabello|shakira|jennifer lopez|cardi b|nicki minaj|doja cat|sza|ice spice|madison beer|olivia rodrigo|vanessa hudgens|ashley benson|lucy hale|troian bellisario|shay mitchell|emily ratajkowski|bella hadid|gigi hadid|kendall jenner|kourtney kardashian|khloe kardashian|kris jenner|kylie minogue|dolly parton|miley cyrus|demi lovato|ariana debose|rachel zegler|zendaya coleman)\b|హీరోయిన్|నటి|అందాల|భామ|గ్లామర్|తార|సుందరి|நடிகை|கதாநாயகி|நடிகையின்|നടി|നായിക|ನಟಿ|ನಾಯಕಿ/i;

/**
 * Generic female-subject cues. Picture desks often headline a heroine without
 * naming her ("she stuns in saree", "this beauty breaks the internet"), so
 * these keep genuine glamour posts flowing while men stay excluded by
 * MALE_SUBJECT above.
 */
const FEMALE_GENERIC =
  /\b(?:she|her|hers|girl|girls|woman|women|lady|ladies|bride|bridal|queen|princess|diva|beauty|babe|belle|dulhan|bhama|sundari|glam|glamour|glamorous|saree|sari|lehenga|salwar|anarkali|gown|bikini|swimsuit|photoshoot)\b|అమ్మాయి|భామ|సుందరి|అందాలు|తార|పెళ్లికూతురు|நடிகை|பெண்|നടി|പെൺ|ನಟಿ|ಹುಡುಗಿ/i;

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
  // Hard news never belongs in a glamour grid.
  if (NEWSY.test(text)) return false;
  // Our own newsroom (bayarea.telugutimes.net) is a trusted first-party desk:
  // its photo galleries and event picture posts belong in Glamourie too.
  const ownSite = /telugutimes\.net/i.test(url);
  const photoDesk =
    (PHOTO_DESK_URL.test(url) && (CINEMA_HOSTS.test(url) || ENTERTAINMENT_URL.test(url))) ||
    (ownSite && (PHOTO_DESK_URL.test(url) || PHOTO_LED.test(text)));
  const photoLed = PHOTO_LED.test(text) || photoDesk;
  if (!photoLed) return false;
  // Strictly no men in Glamourie: any male-subject cue disqualifies the post.
  if (MALE_SUBJECT.test(text)) return false;
  // Glamourie is a female-artist picture desk (Tollywood, Mollywood, Kollywood,
  // Sandalwood, Bollywood, Hollywood). Either a named heroine or a clear
  // female-subject cue has to be present.
  if (!FEMALE_SUBJECT.test(text) && !FEMALE_GENERIC.test(text)) return false;
  return true;
}



/**
 * Group / multi-subject cues. The Glamour folder is a single-woman picture desk:
 * duos, "actresses who…", listicles and couple shots stay in the review desk.
 */
const MULTI_SUBJECT =
  /\b(?:actresses|heroines|divas|beauties|stars|celebs|celebrities|girls|women|ladies|sisters|duo|trio|couple|couples|pair|family|together|with\s+(?:her|his)?\s*(?:husband|hubby|wife|boyfriend|co-?star|friend|mother|father|son|daughter|kids?)|and\s+(?:her|his)\b|top\s*\d+|\d+\s*(?:actresses|heroines|beauties|stars|pics|photos)\s+(?:who|that|you)|these\b|list\b|group|team|cast|event|premiere|red\s*carpet|press\s*meet|audio\s*launch|awards?)\b|&|,\s*\w+\s+(?:and|&)\s+\w+/i;

/**
 * A man anywhere in the frame disqualifies the picture. Named male stars are
 * caught by MALE_SUBJECT; these are the unnamed cues — pronouns, relationships
 * and couple/wedding framing — that let "woman with a man" shots slip through.
 */
const MALE_PRESENT =
  /\b(?:he|his|him|himself|husband|hubby|boyfriend|bf|beau|fiance|fianc[eé]e?|partner|groom|bridegroom|spouse|male|man|men|guy|boy|brother|bro|father|dad|son|uncle|co-?star|hero|actor|singer|director|producer|rapper|cricketer|businessman|mr\.?|sir)\b|\b(?:couple|couples|romance|romantic|dating|date night|engagement|engaged|wedding|weds|marriage|married|honeymoon|pre-?wedding|reception|anniversary|kiss|kissing|hug|hugging|lip lock|liplock|holding hands|walk hand)\b|\bwith\s+(?:her|his)\b|భర్త|ప్రియుడు|జంట|పెళ్లి|వివాహ|నటుడు/i;

/**
 * True when a picture post reads as a solo female star portrait — the only kind
 * that may go into the Glamour folder without an editor's approval.
 */
export function isSingleWoman(
  title: string | null | undefined,
  summary?: string | null,
  sourceUrl?: string | null,
): boolean {
  if (!isStarGallery(title, summary, sourceUrl)) return false;
  const text = `${title ?? ""} ${summary ?? ""}`;
  if (MULTI_SUBJECT.test(text)) return false;
  // Any male presence — named or implied — keeps the photo in the picture desk.
  if (MALE_SUBJECT.test(text) || MALE_PRESENT.test(text)) return false;
  return true;
}
