/**
 * Front-page safety gate.
 *
 * Violent crime, accidents, tragedy and court/police stories are never featured
 * in the hero carousel or any top "prime" slot — the front page is a
 * family-audience shelf. These stories still appear in the regular news lists
 * and on their category pages.
 */

const HERO_UNSAFE =
  /\b(murder|murdered|killed|killing|kills|shot|shooting|shoot[- ]?out|gunman|gun|stabb\w*|homicide|rape|raped|sexual|molest\w*|assault\w*|abuse|suicide|self[- ]harm|overdose|arrest\w*|indict\w*|convict\w*|charged|jail\w*|prison|lawsuit|sued|fraud|scam|hate crime|riot|terror\w*|bomb\w*|hostage|kidnap\w*|missing|crash|collision|derail\w*|fatal\w*|died|dies|dead|death|deaths|body found|drown\w*|wildfire|injur\w*|victim|deport\w*|ice raid|immigration raid|police|sheriff|fbi|court|custody|allegation|alleged|accus\w*|harass\w*|misconduct|tragedy|tragic|mourn\w*|funeral|obituary)\b/i;

/** True when this text must be kept out of the hero and featured slots. */
export function isHeroUnsafeText(title?: string | null, excerpt?: string | null): boolean {
  return HERO_UNSAFE.test(`${title ?? ""} ${excerpt ?? ""}`);
}
