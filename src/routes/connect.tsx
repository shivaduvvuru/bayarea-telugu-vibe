import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Building2,
  Users,
  Landmark,
  Stethoscope,
  Briefcase,
  Tag,
  Send,
} from "lucide-react";
import { canonical } from "@/lib/site";
import { useLang } from "@/lib/language";
import { CommunityPoll, VoicesRail } from "@/components/genz";
import { SectionHeading } from "@/components/news";
import { track } from "@/lib/analytics";

const TITLE = "Connect — Telugu associations, temples, professionals & jobs in the Bay Area";
const DESC =
  "Find Bay Area Telugu associations, temples, professionals, jobs and classifieds, or submit your own listing.";
const URL = canonical("/connect");

export const Route = createFileRoute("/connect")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: ConnectPage,
});

const LINKS = [
  { en: "Community Directory", te: "కమ్యూనిటీ డైరెక్టరీ", icon: Building2, to: "/directory" as const },
  { en: "Telugu Associations", te: "తెలుగు సంఘాలు", icon: Users, category: "associations" },
  { en: "Temples", te: "దేవాలయాలు", icon: Landmark, category: "temples" },
  { en: "Professionals", te: "నిపుణులు", icon: Stethoscope, category: "people" },
  { en: "Jobs", te: "ఉద్యోగాలు", icon: Briefcase, category: "classifieds" },
  { en: "Classifieds", te: "క్లాసిఫైడ్స్", icon: Tag, category: "classifieds" },
  { en: "Submit Content", te: "కంటెంట్ పంపండి", icon: Send, to: "/contact" as const },
];

function ConnectPage() {
  const { lang, t } = useLang();
  const cls =
    "flex min-h-14 items-center gap-3 rounded-xl border border-border bg-background px-4 text-[15px] font-semibold text-ink transition-colors hover:border-primary";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:py-8">
      <h1 className="text-3xl font-bold text-ink">{t("Connect", "కనెక్ట్")}</h1>
      <p className="mt-2 text-base text-muted-foreground">
        {t(
          "The people, organisations and services that make up the Bay Area Telugu community.",
          "బే ఏరియా తెలుగు కమ్యూనిటీలోని వ్యక్తులు, సంస్థలు, సేవలు.",
        )}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {LINKS.map((l) => {
          const Icon = l.icon;
          const inner = (
            <>
              <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              <span className={lang === "te" ? "te-text" : undefined}>
                {lang === "te" ? l.te : l.en}
              </span>
            </>
          );
          return l.to ? (
            <Link
              key={l.en}
              to={l.to}
              className={cls}
              onClick={() => track("directory_click", { target: l.en })}
            >
              {inner}
            </Link>
          ) : (
            <Link
              key={l.en}
              to="/category/$category"
              params={{ category: l.category! }}
              className={cls}
              onClick={() => track("directory_click", { target: l.en })}
            >
              {inner}
            </Link>
          );
        })}
      </div>

      <p className="mt-4 rounded-lg bg-surface-tint p-4 text-sm text-muted-foreground">
        {t(
          "Own a business or run an association? Directory profiles can be claimed and updated by their owners after editorial approval.",
          "వ్యాపారం లేదా సంఘం నడుపుతున్నారా? ఎడిటోరియల్ ఆమోదం తర్వాత మీ డైరెక్టరీ ప్రొఫైల్‌ను మీరే అప్‌డేట్ చేసుకోవచ్చు.",
        )}{" "}
        <Link to="/contact" className="font-semibold text-primary">
          {t("Claim your listing", "మీ లిస్టింగ్ క్లెయిమ్ చేయండి")}
        </Link>
      </p>

      <section className="mt-10">
        <SectionHeading te="విద్యార్థుల గొంతుకలు" en="Student & Young Professional Voices" />
        <VoicesRail />
      </section>

      <section className="mt-10 max-w-xl">
        <CommunityPoll />
      </section>
    </div>
  );
}