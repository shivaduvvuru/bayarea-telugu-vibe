import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  CalendarPlus,
  Users,
  Landmark,
  UtensilsCrossed,
  Stethoscope,
  Briefcase,
  Tag,
  Megaphone,
} from "lucide-react";
import { useLang } from "@/lib/language";

const ITEMS = [
  { en: "Events This Weekend", te: "ఈ వారాంతం", icon: CalendarDays, to: "/events" },
  { en: "Submit an Event", te: "ఈవెంట్ పంపండి", icon: CalendarPlus, to: "/contact" },
  
  { en: "Temples", te: "దేవాలయాలు", icon: Landmark, to: "/category/$category", param: "temples" },
  { en: "Restaurants", te: "రెస్టారెంట్లు", icon: UtensilsCrossed, to: "/category/$category", param: "restaurants" },
  { en: "Doctors & Professionals", te: "డాక్టర్లు & నిపుణులు", icon: Stethoscope, to: "/directory" },
  { en: "Jobs", te: "ఉద్యోగాలు", icon: Briefcase, to: "/category/$category", param: "classifieds" },
  { en: "Classifieds", te: "క్లాసిఫైడ్స్", icon: Tag, to: "/category/$category", param: "classifieds" },
  { en: "Advertise With Us", te: "ప్రకటనలు", icon: Megaphone, to: "/contact" },
] as const;

export function QuickLinks() {
  const { t } = useLang();

  return (
    <nav aria-label={t("Community shortcuts", "కమ్యూనిటీ లింక్‌లు")}>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const content = (
            <>
              <Icon className="h-5 w-5 shrink-0 text-primary" />
              <span className="w-full text-center text-[12px] leading-tight font-semibold text-ink">
                {t(item.en, item.te)}
              </span>
            </>
          );
          const className =
            "flex min-h-[76px] flex-col items-center justify-center gap-1.5 border border-border bg-surface-tint p-2 transition-colors hover:border-primary";
          return (
            <li key={item.en}>
              {"param" in item && item.param ? (
                <Link
                  to="/category/$category"
                  params={{ category: item.param }}
                  className={className}
                >
                  {content}
                </Link>
              ) : (
                <Link to={item.to as "/events" | "/contact" | "/directory"} className={className}>
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
