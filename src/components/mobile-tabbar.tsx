import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  Store,
  Landmark,
  BookOpen,
  Megaphone,
  ClipboardCheck,
  LogIn,
  Settings,
  Menu,
  X,
  Utensils,
  Heart,
  Tag,
  Home,
  Newspaper,
  Lock,
} from "lucide-react";


import { supabase } from "@/integrations/supabase/client";


/** Red text rail at the bottom — utilities, no overlap with the top rail. */
const TEXT_TABS = [
  { to: "/category/$category", params: { category: "fun-zone" }, label: "Fun Zone" },
  { to: "/directory", label: "Directory" },
  { to: "/associations", label: "Associations" },
  { to: "/connect", label: "Community" },
] as const;

/** White icon strip below the red rail — local, practical destinations. */
const ICON_TABS = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/events", icon: CalendarDays, label: "Events" },
  { to: "/temples", icon: Landmark, label: "Temples" },
  { to: "/category/$category", params: { category: "restaurants" }, icon: Utensils, label: "Food" },
  { to: "/category/$category", params: { category: "classifieds" }, icon: Tag, label: "Classifieds" },
] as const;

/** Everything that is not in the top mobile rail or bottom bars. */
const MORE = [
  { to: "/desk", icon: Lock, label: "Review desk" },
  { to: "/favorites", icon: Heart, label: "Saved photos" },
  { to: "/people", icon: BookOpen, label: "People" },
  { to: "/epaper", icon: Newspaper, label: "E-Paper" },
  { to: "/submit", icon: Megaphone, label: "Submit a Story" },
  { to: "/contact", icon: Store, label: "Advertise" },
] as const;


/** Editorial tools — only for signed-in staff. */
const STAFF = [
  { to: "/desk", icon: ClipboardCheck, label: "Review desk" },
  { to: "/admin", icon: Settings, label: "Newsroom" },
] as const;


const textLinkClass =
  "flex h-full items-center whitespace-nowrap px-2.5 py-2 text-[11px] font-semibold uppercase tracking-tight text-nav-foreground transition-colors hover:bg-nav-hover";

const iconTabClass =
  "flex min-h-13 w-full flex-col items-center justify-center gap-1 px-1 py-1.5 text-[11px] font-semibold text-ink";

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

      {/* White icon strip — sits just above the red text rail. */}
      <nav
        className="fixed inset-x-0 bottom-[2.25rem] z-50 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Mobile icon navigation"
      >
        <ul className="grid grid-cols-6">
          {ICON_TABS.map((item) => (
            <li key={item.label}>
              <Link
                to={item.to}
                {...("params" in item ? { params: item.params } : {})}
                onClick={() => setOpen(false)}
                className={iconTabClass}
                activeProps={{ className: "text-primary bg-surface-tint" }}
                activeOptions={"params" in item ? { exact: false } : { exact: true }}
              >
                <item.icon className="h-5 w-5 shrink-0 text-primary" />
                <span className="w-full truncate text-center">{item.label}</span>
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className={`${iconTabClass} ${open ? "text-primary bg-surface-tint" : ""}`}
            >
              {open ? <X className="h-5 w-5 text-primary" /> : <Menu className="h-5 w-5 text-primary" />}
              <span>{open ? "Close" : "More"}</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* Red text rail at the very bottom — same style as the top rail. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border/40 bg-nav md:hidden"
        aria-label="Mobile section navigation"
      >
        {open && (
          <ul className="grid grid-cols-3 gap-px border-b border-border/40 bg-border">
            {sheetItems.map((item) => (
              <li key={item.label} className="bg-background">
                <Link
                  to={item.to}
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
        <div className="flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-[env(safe-area-inset-bottom)]">
          <ul className="mx-auto flex max-w-6xl items-center gap-1 px-2">
            {TEXT_TABS.map((item) => (
              <li key={item.label}>
                <Link
                  to={item.to}
                  {...("params" in item ? { params: item.params } : {})}
                  onClick={() => setOpen(false)}
                  className={textLinkClass}
                  activeProps={{ className: "underline" }}
                  activeOptions={"params" in item ? { exact: false } : { exact: true }}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className={`${textLinkClass} inline-flex items-center gap-0.5 ${open ? "underline" : ""}`}
              >
                More
                {open ? <X className="h-3 w-3" /> : <Menu className="h-3 w-3" />}
              </button>
            </li>
          </ul>
        </div>
      </nav>
    </>
  );
}
