import { TT_LINKS } from "@/lib/network-links";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Menu,
  X,
  Youtube,
  Newspaper,
  Search,
  Globe,
  Instagram,
  Facebook,
  ChevronDown,
} from "lucide-react";
import masthead from "@/assets/masthead.webp";
import { CATEGORIES, CITY_REGIONS } from "@/lib/content";
import { useLang } from "@/lib/language";
import { onOpenMobileMenu } from "@/lib/ui-menu";


/** Telugu Times social profiles, shown as a row under the utility links. */
const SOCIAL = [
  { href: TT_LINKS.youtube, label: "YouTube", icon: Youtube },
  { href: TT_LINKS.instagram, label: "Instagram", icon: Instagram },
  { href: TT_LINKS.facebook, label: "Facebook", icon: Facebook },
] as const;

function SocialRow({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {SOCIAL.map(({ href, label, icon: Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={`Telugu Times on ${label}`}
          className="flex h-10 w-10 items-center justify-center rounded-sm text-nav-foreground/85 transition-colors hover:bg-nav-hover"
        >
          <Icon className="h-5 w-5" />
        </a>
      ))}
    </div>
  );
}

function HeaderSearch({ className = "" }: { className?: string }) {
  const navigate = useNavigate();
  const { t } = useLang();
  const [q, setQ] = useState("");
  return (
    <form
      role="search"
      className={`flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 focus-within:border-primary ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (!q.trim()) return;
        void navigate({ to: "/search", search: { q: q.trim() } });
      }}
    >
      <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label={t("Search Bay Area Telugu Times", "వెతకండి")}
        placeholder={t("Search news, temples, events", "వార్తలు, దేవాలయాలు, ఈవెంట్లు")}
        className="w-44 bg-transparent text-xs text-ink outline-none placeholder:text-muted-foreground lg:w-56"
      />
    </form>
  );
}

const UTILITY_LINKS = [
  { to: "/events", en: "Events Calendar", te: "ఈవెంట్స్ క్యాలెండర్" },
  { to: "/directory", en: "Community Directory", te: "కమ్యూనిటీ డైరెక్టరీ" },
  { to: "/temples", en: "Temple Directory", te: "దేవాలయ డైరెక్టరీ" },
  { to: "/politics", en: "City Hall & Indian Politics", te: "రాజకీయాలు" },
  { to: "/foundation-icons", en: "Foundation Icons", te: "ఫౌండేషన్ ఐకాన్స్" },
  { to: "/submit", en: "Submit a Story or Event", te: "వార్త / ఈవెంట్ పంపండి" },
  { to: "/about", en: "About Us", te: "మా గురించి" },
] as const;

const NAV_LINK =
  "flex h-full items-center whitespace-nowrap rounded-sm px-1.5 py-2 text-[10px] font-semibold uppercase tracking-tight text-nav-foreground transition-colors hover:bg-nav-hover lg:px-2 lg:text-xs";
const NAV_LINK_SECONDARY =
  "flex h-full items-center whitespace-nowrap rounded-sm px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-tight text-nav-foreground/90 transition-colors hover:bg-nav-hover hover:text-nav-foreground lg:px-2 lg:text-xs";
const NAV_ACTIVE = { className: "bg-nav-hover underline" };

const COMMUNITY_ITEMS = [
  { en: "Community Forums", to: "/forums" },
  { en: "Events Calendar", to: "/events" },
  { en: "Associations", to: "/associations" },
  { en: "People", to: "/people" },
  { en: "Foundation Icons", to: "/foundation-icons" },
  { en: "Groups", cat: "groups" },
] as const;

/** First row of the two-line desktop navigation. */
const MENU_ROW_1 = [
  { en: "City News", cat: "city-news", mega: true },
  { en: "Community", cat: "community", items: COMMUNITY_ITEMS },
  { en: "Cinema", cat: "cinema" },
  { en: "Restaurants", cat: "restaurants" },
  { en: "Fun Zone", cat: "fun-zone" },
  { en: "Classifieds", cat: "classifieds" },
] as const;

/** Second row of the two-line desktop navigation. */
const MENU_ROW_2 = [
  { en: "Political", cat: "political" },
  { en: "Temples", to: "/temples" },
  { en: "Gallery", cat: "gallery" },
  { en: "Events", to: "/events" },
  { en: "Readers", cat: "readers-column" },
  { en: "Advertise", to: "/contact" },
] as const;

function NavItem({
  item,
  navLink,
}: {
  item: (typeof MENU_ROW_1)[number] | (typeof MENU_ROW_2)[number];
  navLink: string;
}) {
  const hasMenu = "items" in item;
  const hasMega = "mega" in item;
  return (
    <li key={item.en} className="group relative">
      {"to" in item ? (
        <Link
          to={item.to}
          className={`${navLink} inline-flex items-center gap-0.5`}
          activeProps={NAV_ACTIVE}
          activeOptions={{}}
        >
          {item.en}
          {hasMenu || hasMega ? <ChevronDown className="h-3 w-3" /> : null}
        </Link>
      ) : (
        <Link
          to="/category/$category"
          params={{ category: item.cat }}
          className={`${navLink} inline-flex items-center gap-0.5`}
          activeProps={NAV_ACTIVE}
        >
          {item.en}
          {hasMenu || hasMega ? <ChevronDown className="h-3 w-3" /> : null}
        </Link>
      )}
      {hasMenu ? (
        <ul className="invisible absolute left-0 top-full z-30 w-60 border border-border bg-background opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100">
          {item.items.map((s) => (
            <li key={s.en}>
              {"to" in s ? (
                <Link
                  to={s.to}
                  className="block px-3 py-2 text-sm font-medium text-ink hover:bg-surface-tint hover:text-primary"
                >
                  {s.en}
                </Link>
              ) : (
                <Link
                  to="/category/$category"
                  params={{ category: s.cat }}
                  className="block px-3 py-2 text-sm font-medium text-ink hover:bg-surface-tint hover:text-primary"
                >
                  {s.en}
                </Link>
              )}
            </li>
          ))}
        </ul>
      ) : hasMega ? (
        <div className="invisible absolute left-0 top-full z-30 grid w-[46rem] grid-cols-4 gap-4 border border-border bg-background p-4 opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100">
          {CITY_REGIONS.map((r) => (
            <div key={r.key}>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-primary">
                {r.en}
              </p>
              <ul>
                {r.cities.map((s) => (
                  <li key={s.slug}>
                    <Link
                      to="/category/$category"
                      params={{ category: s.slug }}
                      className="block py-1 text-sm font-medium text-ink hover:text-primary"
                    >
                      {s.en}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function MobileNavItem({
  item,
}: {
  item: (typeof MENU_ROW_1)[number] | (typeof MENU_ROW_2)[number];
}) {
  const base =
    "inline-flex items-center whitespace-nowrap rounded-sm px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-tight text-nav-foreground transition-colors hover:bg-nav-hover";
  return "to" in item ? (
    <Link to={item.to} className={base} activeProps={NAV_ACTIVE} activeOptions={{}}>
      {item.en}
    </Link>
  ) : (
    <Link
      to="/category/$category"
      params={{ category: item.cat }}
      className={base}
      activeProps={NAV_ACTIVE}
    >
      {item.en}
    </Link>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { lang, t } = useLang();
  useEffect(() => onOpenMobileMenu(() => setOpen((v) => !v)), []);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background md:static">
      {/* Desktop utility bar — search + language */}
      <div className="hidden border-b border-border/70 bg-surface-tint md:block">
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-4 px-4 py-1.5 text-xs text-muted-foreground">
          <HeaderSearch />
        </div>
      </div>

      {/* Mobile bar: hamburger · logo · language · search */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 md:hidden">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-11 w-11 items-center justify-center text-ink"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
        <Link to="/" className="flex min-w-0 justify-center">
          <img
            src={masthead}
            alt="Bay Area Telugu Times"
            width={1408}
            height={512}
            loading="eager"
            fetchPriority="high"
            className="h-9 w-auto max-w-full"
          />
        </Link>
        <div className="flex items-center gap-1">
          <Link
            to="/search"
            search={{ q: "" }}
            className="flex h-11 w-11 items-center justify-center text-ink"
            aria-label={t("Search", "వెతకండి")}
          >
            <Search className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* Desktop masthead */}
      <div className="mx-auto hidden max-w-6xl items-center justify-between gap-4 px-4 py-5 md:flex">
        <Link to="/" className="shrink-0">
          <img
            src={masthead}
            alt="Bay Area Telugu Times"
            width={1408}
            height={512}
            loading="eager"
            fetchPriority="high"
            className="h-16 w-auto"
          />
        </Link>
        <div className="flex w-full max-w-xl items-center justify-end gap-2">
          <SocialRow />
        </div>
      </div>

      {/* Network links + social strip — above main menu, very small script (mobile + desktop) */}
      <div className="border-y border-border/70 bg-surface-tint">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-2 py-0.5 text-[9px] text-muted-foreground md:gap-4 md:px-4 md:text-[10px]">
          <nav aria-label="Telugu Times network" className="flex min-w-0 items-center">
            <a
              href={TT_LINKS.site}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 pr-1 font-medium text-ink hover:text-primary md:pr-2"
            >
              <Globe className="h-3 w-3 text-primary" />
              TeluguTimes.net
            </a>
            <span className="h-3 w-px bg-border" />
            <Link
              to="/epaper"
              className="flex items-center gap-1 px-1 font-medium text-ink hover:text-primary md:px-2"
            >
              <Newspaper className="h-3 w-3 text-primary" />
              E-Paper
            </Link>
            <span className="h-3 w-px bg-border hidden sm:block" />
            <Link to="/submit" className="hidden px-1 hover:text-primary sm:block md:px-2">
              {t("Submit News", "వార్తలు పంపండి")}
            </Link>
          </nav>

          <span className="flex items-center gap-0.5">
            {SOCIAL.map(({ href, label: l, icon: Icon }) => (
              <a
                key={l}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={`Telugu Times on ${l}`}
                className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-background hover:text-primary md:h-5 md:w-5"
              >
                <Icon className="h-2.5 w-2.5 md:h-3 md:w-3" />
              </a>
            ))}
          </span>
        </div>
      </div>

      <nav className="border-t border-border bg-nav">
        {/* Mobile main menu bar — visible scrollable red nav below masthead (first row only) */}
        <div className="md:hidden overflow-x-auto border-b border-border/40">
          <ul className="flex min-w-max items-center gap-1 px-2 py-2">
            {MENU_ROW_1.map((m) => (
              <li key={m.en}>
                <MobileNavItem item={m} />
              </li>
            ))}
          </ul>
        </div>

        {/* Two-line desktop navigation */}
        <div className="mx-auto hidden max-w-7xl flex-col md:flex px-2 lg:px-4">
          <ul className="grid min-w-0 grid-cols-6 items-stretch text-center">
            {MENU_ROW_1.map((m) => (
              <NavItem key={m.en} item={m} navLink={NAV_LINK} />
            ))}
          </ul>
          <ul className="grid min-w-0 grid-cols-6 items-stretch border-t border-border/40 text-center">
            {MENU_ROW_2.map((m) => (
              <NavItem key={m.en} item={m} navLink={NAV_LINK_SECONDARY} />
            ))}
          </ul>
        </div>


        {open && (
          <ul className="max-h-[70dvh] overflow-y-auto overscroll-contain border-t border-border bg-background px-4 pb-4 md:hidden">
            <li className="flex flex-col gap-2 border-b border-border/60 py-3">
              <HeaderSearch className="w-full [&_input]:w-full [&_input]:text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={TT_LINKS.site}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-11 items-center justify-center gap-1.5 rounded-sm border border-border text-sm font-semibold text-ink"
                >
                  <Globe className="h-4 w-4 text-primary" />
                  TeluguTimes.net
                </a>
                <Link
                  to="/epaper"
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center justify-center gap-1.5 rounded-sm border border-border text-sm font-semibold text-ink"
                >
                  <Newspaper className="h-4 w-4 text-primary" />
                  E-Paper
                </Link>
              </div>
              <Link
                to="/contact"
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center justify-center rounded-sm bg-primary text-sm font-semibold text-primary-foreground"
              >
                {t("Advertise With Us", "ప్రకటనల కోసం")}
              </Link>
              <SocialRow className="justify-center text-ink [&_a]:text-ink" />
            </li>
            {UTILITY_LINKS.map((l) => (
              <li key={`${l.to}-${l.en}`} className="border-b border-border/60">
                <Link
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className="flex min-h-12 items-center text-base font-semibold text-primary"
                >
                  {l.en}
                </Link>
              </li>
            ))}
            <li className="pt-3 pb-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Sections
            </li>
            {CATEGORIES.map((c) => (
              <li key={c.slug} className="border-b border-border/60 last:border-0">
                <Link
                  to="/category/$category"
                  params={{ category: c.slug }}
                  onClick={() => setOpen(false)}
                  className="flex min-h-12 items-center justify-between gap-2 py-3 text-base font-semibold text-ink"
                >
                  {c.en}
                </Link>
                {c.slug === "city-news" ? (
                  <div className="pb-2 pl-3">
                    {CITY_REGIONS.map((r) => (
                      <div key={r.key} className="pb-1">
                        <p className="pt-1 text-xs font-bold uppercase tracking-widest text-primary">
                          {r.en}
                        </p>
                        <ul>
                          {r.cities.map((s) => (
                            <li key={s.slug}>
                              <Link
                                to="/category/$category"
                                params={{ category: s.slug }}
                                onClick={() => setOpen(false)}
                                className="flex min-h-11 items-center justify-between gap-2 text-sm text-muted-foreground"
                              >
                                {s.en}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : c.children ? (
                  <ul className="pb-2 pl-3">
                    {c.children.map((s) => (
                      <li key={s.slug}>
                        <Link
                          to="/category/$category"
                          params={{ category: s.slug }}
                          onClick={() => setOpen(false)}
                          className="flex min-h-11 items-center justify-between gap-2 text-sm text-muted-foreground"
                        >
                            {s.en}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </nav>
    </header>
  );
}
