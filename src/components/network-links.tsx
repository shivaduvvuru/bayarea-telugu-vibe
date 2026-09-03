import { Youtube, Instagram, Facebook, Newspaper, Globe } from "lucide-react";
import { TT_LINKS } from "@/lib/network-links";
import { useLang } from "@/lib/language";

type Item = { href: string; en: string; te: string; icon: typeof Youtube };

const ITEMS: Item[] = [
  { href: TT_LINKS.youtube, en: "YouTube", te: "యూట్యూబ్", icon: Youtube },
  { href: TT_LINKS.epaper, en: "E-Paper", te: "ఈ-పేపర్", icon: Newspaper },
  { href: TT_LINKS.instagram, en: "Instagram", te: "ఇన్‌స్టాగ్రామ్", icon: Instagram },
  { href: TT_LINKS.facebook, en: "Facebook", te: "ఫేస్‌బుక్", icon: Facebook },
  { href: TT_LINKS.site, en: "TeluguTimes.net", te: "తెలుగు టైమ్స్", icon: Globe },
];

/** Compact row of community network links (site, e-paper, social). */
export function NetworkLinks({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { t } = useLang();
  const base =
    tone === "dark"
      ? "border-background/20 text-background/80 hover:border-background hover:text-background"
      : "border-border text-ink hover:border-primary hover:text-primary";
  return (
    <nav
      aria-label={t("Community network", "కమ్యూనిటీ నెట్‌వర్క్")}
      className="flex flex-wrap items-center gap-2"
    >
      {ITEMS.map(({ href, en, te, icon: Icon }) => (
        <a
          key={en}
          href={href}
          target="_blank"
          rel="noreferrer"
          className={`inline-flex min-h-11 items-center gap-1.5 rounded-sm border px-3 text-[13px] font-semibold transition-colors ${base}`}
        >
          <Icon className="h-4 w-4" aria-hidden />
          <span className="leading-tight">
            {en}
            <span className="te-text block text-[10px] font-medium opacity-70">{te}</span>
          </span>
        </a>
      ))}
    </nav>
  );
}
