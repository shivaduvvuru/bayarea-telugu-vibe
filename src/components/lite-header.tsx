import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
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

export function LiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-2">
        <Link to="/lite" className="shrink-0" aria-label="Bay Area Telugu Times home">
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
        </div>
      </nav>
    </header>
  );
}