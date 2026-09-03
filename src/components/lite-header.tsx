import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, ClipboardCheck, LogIn, LogOut, Search, Sparkles, X } from "lucide-react";
import { useSignedIn, signOutSession } from "@/lib/session-state";


/**
 * Economic-Times-style lean header: one identity row, one category rail.
 * No social strip, no tagline block, no mega-menu — content starts fast.
 */
/** Focused top rail — the most-used destinations stay visible; the rest live in More. */
const RAIL = [
  { to: "/category/$category", params: { category: "city-news" }, label: "City News" },
  { to: "/category/$category", params: { category: "india-news" }, label: "India" },
  { to: "/category/$category", params: { category: "cinema" }, label: "Cinema/OTT" },
  { to: "/category/$category", params: { category: "gallery" }, label: "Glamour" },
  { to: "/events", label: "Events" },
  { to: "/food", label: "Food" },
  { to: "/category/$category", params: { category: "fun-zone" }, label: "Fun Zone" },
] as const;

/** Mobile top rail — concise discovery destinations; utilities live in the bottom bars. */
const MOBILE_RAIL = [
  { to: "/category/$category", params: { category: "city-news" }, label: "City News" },
  { to: "/category/$category", params: { category: "india-news" }, label: "India" },
  { to: "/category/$category", params: { category: "cinema" }, label: "Cinema/OTT" },
  { to: "/category/$category", params: { category: "gallery" }, label: "Glamour" },
  { to: "/category/$category", params: { category: "fun-zone" }, label: "Fun Zone" },
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
    heading: "Food",
    items: [
      { to: "/food", label: "Food home" },
      { to: "/food/restaurants", label: "All restaurants" },
      { to: "/food/deals", label: "Deals & coupons" },
      { to: "/food/add", label: "Add / claim a restaurant" },
    ],
  },
  {
    heading: "Explore",
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
    { to: "/temple-sources", label: "Temple sources" },
    { to: "/admin", label: "Newsroom CMS" },

  ],
};



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

        </div>
      ) : null}
    </div>
  );
}

export function LiteHeader() {
  const signedIn = useSignedIn();
  const navigate = useNavigate();

  const signOut = async () => {
    await signOutSession();
    void navigate({ to: "/auth", replace: true });
  };

  return (
    <header className="glass-bar sticky top-0 z-40 border-b border-border/70">

      <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-2">
        <Link to="/" className="shrink-0" aria-label="Times Bay Area home">
          <span className="flex min-w-0 items-center gap-2 leading-none">
            <img
              src={logoUrl}
              alt="Times Bay Area"
              width={40}
              height={40}
              className="h-9 w-9 shrink-0 object-contain"
            />
            <span className="flex min-w-0 flex-col leading-none">
              <span className="font-serif-display text-[22px] font-bold tracking-tight text-ink sm:text-[25px]">
                Times Bay Area
              </span>
              <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                For Indian Community — What Matters Around You
              </span>
            </span>
          </span>
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
          <Link
            to="/"
            hash="daily-smart-digest"
            className="press inline-flex items-center gap-1 rounded-full border border-primary px-2.5 py-1 text-[11px] font-semibold text-primary"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Smart Digest
          </Link>
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
      {/* Desktop rail — focused sections with the rest one tap away. */}
      <nav
        aria-label="Sections"
        className="hidden overflow-x-auto bg-nav [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex"
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
              className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-tight text-nav-foreground"
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
