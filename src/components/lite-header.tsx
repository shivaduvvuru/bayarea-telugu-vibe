import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, ClipboardCheck, Facebook, Globe, Instagram, LogIn, LogOut, Newspaper, Search, X, Youtube } from "lucide-react";
import masthead from "@/assets/masthead.webp";
import { TT_LINKS } from "@/lib/network-links";
import { supabase } from "@/integrations/supabase/client";


/**
 * Economic-Times-style lean header: one identity row, one category rail.
 * No social strip, no tagline block, no mega-menu — content starts fast.
 */
/** Full desktop rail — mirrors the mobile split: news first, then utilities. */
const RAIL = [
  { to: "/category/$category", params: { category: "city-news" }, label: "City News" },
  { to: "/category/$category", params: { category: "india-news" }, label: "India" },
  { to: "/category/$category", params: { category: "cinema" }, label: "Cinema/OTT" },
  { to: "/category/$category", params: { category: "gallery" }, label: "Glamour" },
  { to: "/category/$category", params: { category: "micro-drama" }, label: "Micro-Drama" },
  { to: "/events", label: "Events" },
  { to: "/temples", label: "Temples" },
  { to: "/category/$category", params: { category: "restaurants" }, label: "Food" },
  { to: "/category/$category", params: { category: "fun-zone" }, label: "Fun Zone" },
  { to: "/directory", label: "Directory" },
  { to: "/associations", label: "Associations & Community" },
  { to: "/connect", label: "Services" },
  { to: "/forums", label: "Forums" },
] as const;

/** Mobile top rail — news sections; utilities live in the bottom bars. */
const MOBILE_RAIL = [
  { to: "/category/$category", params: { category: "city-news" }, label: "City News" },
  { to: "/category/$category", params: { category: "india-news" }, label: "India" },
  { to: "/category/$category", params: { category: "cinema" }, label: "Cinema/OTT" },
  { to: "/category/$category", params: { category: "gallery" }, label: "Glamour" },
  { to: "/category/$category", params: { category: "micro-drama" }, label: "Micro-Drama" },
] as const;


type MoreItem = { to: string; params?: { category: string }; label: string };

/** Everything not already on a rail, grouped so the panel scans fast. */
const MORE_GROUPS: ReadonlyArray<{ heading: string; items: ReadonlyArray<MoreItem> }> = [
  {
    heading: "India",
    items: [
      { to: "/category/$category", params: { category: "india-immigration" }, label: "Immigration & Visa" },
      { to: "/category/$category", params: { category: "india-telangana" }, label: "Telangana" },
      { to: "/category/$category", params: { category: "india-andhra" }, label: "Andhra Pradesh" },
      { to: "/category/$category", params: { category: "india-nri" }, label: "NRI & Diaspora" },
      
    ],
  },
  {
    heading: "Community",
    items: [
      { to: "/people", label: "People" },
      { to: "/foundation-icons", label: "Foundation Icons" },
      { to: "/bay-area-icons", label: "Bay Area Icons" },
      { to: "/explore", label: "Explore" },
    ],
  },
  {
    heading: "More from us",
    items: [
      { to: "/category/$category", params: { category: "classifieds" }, label: "Classifieds" },
      { to: "/desk", label: "Review desk" },

      { to: "/favorites", label: "Saved photos" },
      { to: "/epaper", label: "E-Paper" },
      { to: "/submit", label: "Submit a Story" },
      { to: "/about", label: "About Us" },
      { to: "/contact", label: "Advertise / Contact" },
    ],
  },
];


/** Shown only to signed-in users: the editorial tools. */
const STAFF_GROUP: { heading: string; items: ReadonlyArray<MoreItem> } = {
  heading: "Editorial",
  items: [
    { to: "/desk", label: "Review desk" },
    { to: "/luxedesk", label: "Applicant & member review" },
    { to: "/admin", label: "Newsroom CMS" },

  ],
};

/** Shared session flag for the header (sign-in link + staff menu). */
function useSignedIn() {
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
  return signedIn;
}

/** Telugu Times network: site, e-paper and social profiles. */
const NETWORK = [
  { href: TT_LINKS.site, label: "TeluguTimes.net", icon: Globe },
  { href: TT_LINKS.bayarea, label: "Bay Area edition", icon: Globe },
  { href: TT_LINKS.epaper, label: "E-Paper", icon: Newspaper },
  { href: TT_LINKS.youtube, label: "YouTube", icon: Youtube },
  { href: TT_LINKS.instagram, label: "Instagram", icon: Instagram },
  { href: TT_LINKS.facebook, label: "Facebook", icon: Facebook },
] as const;

/** Compact icon row of social profiles, shown in the identity row. */
function SocialIcons() {
  const items = [
    { href: TT_LINKS.youtube, label: "Telugu Times on YouTube", icon: Youtube },
    { href: TT_LINKS.instagram, label: "Telugu Times on Instagram", icon: Instagram },
    { href: TT_LINKS.facebook, label: "Telugu Times on Facebook", icon: Facebook },
  ] as const;
  return (
    <div className="flex items-center gap-1">
      {items.map(({ href, label, icon: Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={label}
          title={label}
          className="press flex h-8 w-8 items-center justify-center rounded-full border border-border text-ink hover:border-primary hover:text-primary"
        >
          <Icon className="h-4 w-4" aria-hidden />
        </a>
      ))}
    </div>
  );
}

function MoreMenu() {
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(0);
  const signedIn = useSignedIn();
  const wrap = useRef<HTMLDivElement>(null);




  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const r = wrap.current?.getBoundingClientRect();
      if (r) setTop(r.bottom);
    };
    measure();
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-0.5 whitespace-nowrap px-2.5 py-2 text-xs font-semibold uppercase tracking-tight text-nav-foreground"
      >
        More
        {open ? <X className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {open ? (
        <div
          style={{ top }}
          className="fixed left-0 right-0 z-50 max-h-[70dvh] overflow-y-auto border-y border-border bg-background p-4 shadow-lg"
        >

          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            {(signedIn ? [...MORE_GROUPS, STAFF_GROUP] : MORE_GROUPS).map((group) => (
              <div key={group.heading}>
                <p className="mb-1.5 border-b border-border pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {group.heading}
                </p>
                <ul className="flex flex-col">
                  {group.items.map((item) => (
                    <li key={item.label}>
                      <Link
                        to={item.to}
                        {...(item.params ? { params: item.params } : {})}
                        onClick={() => setOpen(false)}
                        className="block py-1.5 text-[13px] font-medium text-ink hover:text-primary"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-4 max-w-6xl border-t border-border pt-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Telugu Times network
            </p>
            <div className="flex flex-wrap gap-2">
              {NETWORK.map(({ href, label, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[12px] font-semibold text-ink hover:border-primary hover:text-primary"
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function LiteHeader() {
  const signedIn = useSignedIn();
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };

  return (
    <header className="glass-bar sticky top-0 z-40 border-b border-border/70">

      <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-2">
        <Link to="/" className="shrink-0" aria-label="Bay Area Telugu Times home">
          <img
            src={masthead}
            alt="Bay Area Telugu Times"
            width={150}
            height={30}
            className="h-7 w-auto"
            decoding="async"
          />
        </Link>
        <div className="ml-auto flex items-center gap-1.5">
          {signedIn ? (
            <Link
              to="/desk"
              className="press flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              Desk
            </Link>
          ) : null}
          <a
            href={TT_LINKS.epaper}
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-ink sm:inline-block"
          >
            E-Paper
          </a>
          <a
            href={TT_LINKS.site}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-ink"
          >
            TeluguTimes.net
          </a>

          <SocialIcons />
          <Link
            to="/search"
            search={{ q: "" }}
            aria-label="Search"
            className="press flex h-8 w-8 items-center justify-center rounded-full border border-border text-ink"
          >
            <Search className="h-4 w-4" />
          </Link>
          {signedIn ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className="press flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-ink"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          ) : (
            <Link
              to="/auth"
              className="press flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground"
            >
              <LogIn className="h-3.5 w-3.5" />
              Sign in
            </Link>
          )}
        </div>
      </div>
      {/* Desktop rail — full section list. */}
      <nav
        aria-label="Sections"
        className="hidden md:flex overflow-x-auto bg-nav [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="mx-auto flex max-w-6xl items-center gap-1 px-2">
          {signedIn ? (
            <Link
              to="/desk"
              activeProps={{ className: "underline" }}
              className="whitespace-nowrap rounded-sm bg-primary px-2.5 py-2 text-xs font-semibold uppercase tracking-tight text-primary-foreground"
            >
              Desk
            </Link>
          ) : null}
          {RAIL.map((item, i) => (
            <Link
              key={i}
              to={item.to}
              // @ts-expect-error — params only present on dynamic entries
              params={item.params}
              activeProps={{ className: "underline" }}
              className="whitespace-nowrap px-2.5 py-2 text-xs font-semibold uppercase tracking-tight text-nav-foreground"
            >
              {item.label}
            </Link>
          ))}

          <MoreMenu />
        </div>
      </nav>

      {/* Mobile top rail — paired with the bottom tab bar. */}
      <nav
        aria-label="Sections"
        className="flex md:hidden overflow-x-auto bg-nav [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="mx-auto flex max-w-6xl items-center gap-1 px-2">
          {MOBILE_RAIL.map((item, i) => (
            <Link
              key={i}
              to={item.to}
              params={item.params}
              activeProps={{ className: "underline" }}
              className="whitespace-nowrap px-2.5 py-2 text-xs font-semibold uppercase tracking-tight text-nav-foreground"
            >
              {item.label}
            </Link>
          ))}

          <MoreMenu />
        </div>
      </nav>
    </header>
  );
}
