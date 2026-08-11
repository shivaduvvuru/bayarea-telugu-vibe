import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, Search, X } from "lucide-react";
import masthead from "@/assets/masthead.webp";
import { TT_LINKS } from "@/lib/network-links";
import { supabase } from "@/integrations/supabase/client";


/**
 * Economic-Times-style lean header: one identity row, one category rail.
 * No social strip, no tagline block, no mega-menu — content starts fast.
 */
const RAIL = [
  { to: "/", label: "Home" },
  { to: "/events", label: "Events" },
  { to: "/temples", label: "Temples" },
  { to: "/politics", label: "Political" },
  { to: "/directory", label: "Directory" },
  { to: "/category/$category", params: { category: "cinema" }, label: "Cinema" },
  { to: "/category/$category", params: { category: "restaurants" }, label: "Food" },
  { to: "/forums", label: "Forums" },
] as const;

type MoreItem = { to: string; params?: { category: string }; label: string };

/** Everything else from the full site menu, grouped so the panel scans fast. */
const MORE_GROUPS: ReadonlyArray<{ heading: string; items: ReadonlyArray<MoreItem> }> = [
  {
    heading: "Sections",
    items: [
      { to: "/category/$category", params: { category: "city-news" }, label: "City News" },
      { to: "/category/$category", params: { category: "gallery" }, label: "Gallery" },
      { to: "/category/$category", params: { category: "fun-zone" }, label: "Fun Zone" },
      { to: "/category/$category", params: { category: "classifieds" }, label: "Classifieds" },
      { to: "/category/$category", params: { category: "readers-column" }, label: "Readers' Column" },
    ],
  },
  {
    heading: "Community",
    items: [
      { to: "/associations", label: "Associations" },
      { to: "/people", label: "People" },
      { to: "/foundation-icons", label: "Foundation Icons" },
      { to: "/bay-area-icons", label: "Bay Area Icons" },
      { to: "/explore", label: "Explore" },
      { to: "/connect", label: "Connect" },
    ],
  },
  {
    heading: "More from us",
    items: [
      { to: "/epaper", label: "E-Paper" },
      { to: "/submit", label: "Submit a Story" },
      { to: "/about", label: "About Us" },
      { to: "/contact", label: "Advertise / Contact" },
    ],
  },
];

function MoreMenu() {
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(0);
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
            {MORE_GROUPS.map((group) => (
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
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
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
          <a
            href={TT_LINKS.epaper}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-ink"
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
          <Link
            to="/search"
            search={{ q: "" }}
            aria-label="Search"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-ink"
          >
            <Search className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <nav
        aria-label="Sections"
        className="overflow-x-auto bg-nav [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="mx-auto flex max-w-6xl items-center gap-1 px-2">
          {RAIL.map((item) => (
            <Link
              key={item.label}
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
    </header>
  );
}
