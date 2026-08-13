import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  Store,
  Landmark,
  BookOpen,
  Megaphone,
  Vote,
  ClipboardCheck,
  LogIn,
  Settings,
  Menu,
  X,
  Utensils,
  Heart,
  Tag,
  PartyPopper,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";


/** Bottom tab bar destinations — red menu at the foot of the screen. */
const ICON_TABS = [
  { to: "/directory", icon: Store, label: "Directory" },
  { to: "/category/$category", params: { category: "classifieds" }, icon: Tag, label: "Classifieds" },
  { to: "/events", icon: CalendarDays, label: "Events" },
  { to: "/temples", icon: Landmark, label: "Temples" },
  { to: "/category/$category", params: { category: "fun-zone" }, icon: PartyPopper, label: "Fun Zone" },
] as const;

/** Everything that is not in the top mobile rail or bottom tab bar. */
const MORE = [
  { to: "/category/$category", params: { category: "restaurants" }, icon: Utensils, label: "Food" },
  { to: "/category/$category", params: { category: "political" }, icon: Vote, label: "Political" },
  {
    to: "/category/$category",
    params: { category: "readers-column" },
    icon: BookOpen,
    label: "Readers",
  },
  { to: "/favorites", icon: Heart, label: "Saved photos" },
  { to: "/contact", icon: Megaphone, label: "Advertise" },
] as const;

/** Editorial tools — only for signed-in staff. */
const STAFF = [
  { to: "/desk", icon: ClipboardCheck, label: "Review desk" },
  { to: "/admin", icon: Settings, label: "Newsroom" },
] as const;

const tabClass =
  "flex min-h-13 w-full flex-col items-center justify-center gap-1 px-1 py-1.5 text-[11px] font-semibold text-primary-foreground";

export function MobileTabBar() {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setSignedIn(Boolean(session)),
    );
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const sheetItems = signedIn
    ? [...MORE, ...STAFF]
    : [...MORE, { to: "/auth", icon: LogIn, label: "Sign in" } as const];

  return (
    <>
      {open && (

        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label="Mobile navigation"
      >
        {open && (
          <ul className="grid grid-cols-3 gap-px border-b border-border bg-border">
            {sheetItems.map((item) => (
              <li key={item.label} className="bg-background">
                <Link
                  to={item.to}
                  {...("params" in item ? { params: item.params } : {})}
                  onClick={() => setOpen(false)}
                  className="flex min-h-16 w-full flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold text-ink"
                >
                  <item.icon className="h-5 w-5 shrink-0 text-primary" />
                  <span className="w-full truncate text-center">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <ul className="grid grid-cols-5">
          {ICON_TABS.map((item) => (
            <li key={item.label}>
              <Link
                to={item.to}
                {...("params" in item ? { params: item.params } : {})}
                onClick={() => setOpen(false)}
                className={tabClass}
                activeProps={{ className: "text-primary" }}
                activeOptions={"params" in item ? { exact: false } : { exact: true }}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="w-full truncate text-center">{item.label}</span>
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className={`${tabClass} ${open ? "text-primary" : ""}`}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              <span>{open ? "Close" : "More"}</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
