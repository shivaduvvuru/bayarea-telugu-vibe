import { Link } from "@tanstack/react-router";
import { ChevronDown, Search } from "lucide-react";
import masthead from "@/assets/masthead.webp";
import { TT_LINKS } from "@/lib/network-links";

/**
 * Economic-Times-style lean header: one identity row, one category rail.
 * No social strip, no tagline block, no mega-menu — content starts fast.
 */
const RAIL = [
  { to: "/", label: "Top News" },
  { to: "/events", label: "Events" },
  { to: "/temples", label: "Temples" },
  { to: "/politics", label: "Political" },
  { to: "/directory", label: "Directory" },
  { to: "/category/$category", params: { category: "cinema" }, label: "Cinema" },
  { to: "/category/$category", params: { category: "restaurants" }, label: "Food" },
  { to: "/forums", label: "Forums" },
] as const;

/** Everything else from the full site menu, collapsed into one dropdown. */
const MORE: ReadonlyArray<{ to: string; params?: { category: string }; label: string }> = [
  { to: "/category/$category", params: { category: "city-news" }, label: "City News" },
  { to: "/category/$category", params: { category: "gallery" }, label: "Gallery" },
  { to: "/category/$category", params: { category: "fun-zone" }, label: "Fun Zone" },
  { to: "/category/$category", params: { category: "classifieds" }, label: "Classifieds" },
  { to: "/category/$category", params: { category: "readers-column" }, label: "Readers' Column" },
  { to: "/associations", label: "Associations" },
  { to: "/people", label: "People" },
  { to: "/foundation-icons", label: "Foundation Icons" },
  { to: "/bay-area-icons", label: "Bay Area Icons" },
  { to: "/explore", label: "Explore" },
  { to: "/connect", label: "Connect" },
  { to: "/epaper", label: "E-Paper" },
  { to: "/submit", label: "Submit a Story" },
  { to: "/about", label: "About Us" },
  { to: "/contact", label: "Advertise / Contact" },
];

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

          <div className="group relative shrink-0">
            <button
              type="button"
              aria-haspopup="true"
              className="flex items-center gap-0.5 whitespace-nowrap px-2.5 py-2 text-xs font-semibold uppercase tracking-tight text-nav-foreground"
            >
              More
              <ChevronDown className="h-3 w-3" />
            </button>
            <div className="invisible absolute right-0 top-full z-50 w-56 rounded-md border border-border bg-background py-1 opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
              {MORE.map((item) => (
                <Link
                  key={item.label}
                  // @ts-expect-error — params only present on dynamic entries
                  to={item.to}
                  // @ts-expect-error — params only present on dynamic entries
                  params={item.params}
                  className="block px-3 py-2 text-xs font-semibold text-ink hover:bg-muted"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}