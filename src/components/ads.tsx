import { Link } from "@tanstack/react-router";
import { Youtube } from "lucide-react";
import { useLang } from "@/lib/language";
import { COMMUNITY_EMAIL } from "@/lib/community-data";
import { PARENT_SITE } from "@/lib/site";

type Banner = { name: string; href: string; note: string };

/** Partner banners the editorial team sells / trades. */
const PARTNER_BANNERS: Banner[] = [
  { name: "BATA", href: "https://www.bata.org/", note: "Bay Area Telugu Association" },
  { name: "Silicon Andhra", href: "https://siliconandhra.org/", note: "Arts, language, culture" },
  { name: "TANA", href: "https://www.tana.org/", note: "Telugu Association of North America" },
  { name: "ATA", href: "https://ataworld.org/", note: "American Telugu Association" },
  { name: "NRI TDP", href: "https://www.nritdp.com/", note: "NRI TDP Bay Area" },
  { name: "Remitly", href: "https://www.remitly.com/", note: "Send money to India" },
  { name: "Biryani Junction", href: "https://www.google.com/search?q=Biryani+Junction+Bay+Area", note: "Bay Area kitchens" },
  { name: "Bhimavaram Ruchulu", href: "https://www.google.com/search?q=Bhimavaram+Ruchulu+Bay+Area", note: "Andhra meals" },
];

function BannerTile({ b }: { b: Banner }) {
  return (
    <a
      href={b.href}
      target="_blank"
      rel="noreferrer sponsored"
      className="flex min-h-16 flex-col justify-center rounded-sm border border-border bg-surface-tint px-3 py-2.5 transition-colors hover:border-primary"
    >
      <span className="text-sm font-bold text-ink">{b.name}</span>
      <span className="text-[11px] text-muted-foreground">{b.note}</span>
    </a>
  );
}

/** House ads: Telugu Times + the Telugu Times YouTube channel. */
export function LeaderboardBanner() {
  const { t } = useLang();
  return (
    <div className="border-b border-border bg-surface-tint">
      <div className="mx-auto max-w-7xl px-3 py-2.5 sm:px-4">
        <p className="mb-1 text-center text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
          {t("Advertisement", "ప్రకటన")}
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {LEADERBOARD_BANNERS.map((b) => (
            <a
              key={b.name}
              href={b.href}
              target="_blank"
              rel="noreferrer sponsored"
              className="flex min-h-[60px] items-center justify-center rounded-sm border border-border bg-background px-4 py-3 text-center transition-colors hover:border-primary"
            >
              <span>
                <span className="block text-sm font-bold leading-tight text-ink">{b.name}</span>
                <span className="block text-[11px] text-muted-foreground">{b.note}</span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Wide banners shown directly under the main menu (greatandhra.com style). */
const LEADERBOARD_BANNERS: Banner[] = [
  { name: "Advertise on Bay Area Telugu Times", href: "/contact", note: "728x90 leaderboard — reach 50k+ Telugu families" },
  { name: "Telugu Times E-Paper", href: "https://telugutimes.net/", note: "Read today's edition free" },
  { name: "Your Business Here", href: "/contact", note: "Weekly & monthly banner slots available" },
];

export function HouseSkyscraper() {
  const { t } = useLang();
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {t("Advertisement", "ప్రకటన")}
      </p>
      <a
        href={PARENT_SITE}
        target="_blank"
        rel="noreferrer"
        className="block rounded-sm border border-primary bg-primary/5 p-4 transition-colors hover:bg-primary/10"
      >
        <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
          {t("The first global Telugu newspaper", "మొదటి గ్లోబల్ తెలుగు వార్తాపత్రిక")}
        </p>
        <p className="mt-1 text-lg font-bold leading-tight text-ink">Telugu Times</p>
        <p className="mt-1 text-xs text-muted-foreground">telugutimes.net</p>
      </a>
      <a
        href="https://www.youtube.com/@telugutimesdigital"
        target="_blank"
        rel="noreferrer"
        className="block rounded-sm border border-border bg-surface-tint p-4 transition-colors hover:border-primary"
      >
        <Youtube className="h-6 w-6 text-primary" aria-hidden />
        <p className="mt-1.5 text-base font-bold leading-tight text-ink">
          Telugu Times {t("YouTube Channel", "యూట్యూబ్ ఛానెల్")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("Subscribe for daily video news", "రోజువారీ వీడియో వార్తల కోసం సబ్‌స్క్రైబ్")}
        </p>
      </a>
    </div>
  );
}

/** Right-rail skyscraper: house ads on top, partner banners below. */
export function AdRail() {
  const { t } = useLang();
  return (
    <aside className="space-y-3" aria-label={t("Advertisements", "ప్రకటనలు")}>
      <HouseSkyscraper />
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
        {PARTNER_BANNERS.map((b) => (
          <BannerTile key={b.name} b={b} />
        ))}
      </div>
      <Link
        to="/contact"
        className="block rounded-sm border border-dashed border-primary px-3 py-2.5 text-center text-xs font-semibold text-primary hover:bg-primary/5"
      >
        {t("Your banner here — advertise with us", "మీ ప్రకటన ఇక్కడ — మాతో ప్రకటన ఇవ్వండి")}
      </Link>
    </aside>
  );
}

/**
 * Retail sponsor strip. The legacy site ran grocery ads (Whole Foods,
 * Grocery Outlet, Safeway, Trader Joe's) — this is the equivalent surface,
 * pointing at the store listings in our own directory.
 */
const RETAIL_SPONSORS: Banner[] = [
  { name: "Whole Foods Market", href: "https://www.wholefoodsmarket.com/stores", note: "Weekly deals" },
  { name: "Grocery Outlet", href: "https://www.groceryoutlet.com/store-locator", note: "Bargain market" },
  { name: "Safeway", href: "https://local.safeway.com/safeway/ca.html", note: "Just for U offers" },
  { name: "Trader Joe's", href: "https://locations.traderjoes.com/ca/", note: "Neighbourhood grocer" },
  { name: "Sprouts Farmers Market", href: "https://www.sprouts.com/stores/", note: "Fresh produce" },
  { name: "Costco Wholesale", href: "https://www.costco.com/warehouse-locations", note: "Bulk savings" },
];

export function RetailSponsors() {
  const { t } = useLang();
  return (
    <section className="mt-8" aria-label={t("Grocery and retail deals", "కిరాణా మరియు రిటైల్ ఆఫర్లు")}>
      <div className="flex items-baseline justify-between border-b-2 border-primary pb-1.5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink">
          {t("Groceries & Deals", "కిరాణా & ఆఫర్లు")}
        </h2>
        <Link to="/directory" className="text-xs font-semibold text-primary hover:underline">
          {t("All stores in the directory", "డైరెక్టరీలో అన్ని దుకాణాలు")}
        </Link>
      </div>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {t("Advertisement", "ప్రకటన")}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {RETAIL_SPONSORS.map((b) => (
          <BannerTile key={b.name} b={b} />
        ))}
      </div>
    </section>
  );
}

/** Two low-height horizontal promos placed between homepage sections. */
export function TwoUpPromos() {
  const { t } = useLang();
  return (
    <div className="mt-8 grid gap-3 sm:grid-cols-2">
      <Link
        to="/directory"
        className="flex min-h-20 flex-col justify-center rounded-sm border border-border bg-surface-tint px-4 py-3 transition-colors hover:border-primary"
      >
        <p className="text-sm font-bold text-ink">
          {t("Be part of the Bay Area Directory", "బే ఏరియా డైరెక్టరీలో చేరండి")}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("List your business free — write to", "మీ వ్యాపారాన్ని ఉచితంగా నమోదు చేయండి —")}{" "}
          {COMMUNITY_EMAIL}
        </p>
      </Link>
      <Link
        to="/people"
        className="flex min-h-20 flex-col justify-center rounded-sm border border-border bg-surface-tint px-4 py-3 transition-colors hover:border-primary"
      >
        <p className="text-sm font-bold text-ink">
          {t("Join Bay Area Foundation Icons & Bay Area Icons", "బే ఏరియా ఫౌండేషన్ ఐకాన్స్ & బే ఏరియా ఐకాన్స్")}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("Know someone who belongs here? Tell us.", "ఎవరైనా అర్హులు తెలిస్తే మాకు తెలియజేయండి.")}
        </p>
      </Link>
    </div>
  );
}

/** Disclaimer + appeal required on every community page. */
export function CommunityAppeal({ what }: { what?: string }) {
  const { t } = useLang();
  return (
    <p className="mt-8 rounded-sm border border-border bg-surface-tint px-4 py-3 text-sm text-muted-foreground">
      {t(
        `We are reaching community leaders and others and are putting this information on ${what ?? "individuals"}. If you know anyone who fits, please send us the information to `,
        "మేము కమ్యూనిటీ పెద్దలను, ఇతరులను సంప్రదిస్తూ ఈ సమాచారాన్ని అందిస్తున్నాము. మీకు తెలిసిన వారి వివరాలు పంపండి: ",
      )}
      <a href={`mailto:${COMMUNITY_EMAIL}`} className="font-semibold text-primary hover:underline">
        {COMMUNITY_EMAIL}
      </a>
      . {t("Numbers are serial numbers only, not a grading. We add more as we come to know.", "సంఖ్యలు కేవలం క్రమ సంఖ్యలు, ర్యాంకింగ్ కాదు. కొత్తవి తెలిసినప్పుడు జోడిస్తాము.")}
    </p>
  );
}