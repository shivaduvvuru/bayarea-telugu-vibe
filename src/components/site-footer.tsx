import { TT_LINKS } from "@/lib/network-links";
import { Link } from "@tanstack/react-router";
import { CATEGORIES } from "@/lib/wp";
import { useLang } from "@/lib/language";

const COMMUNITY = [
  { to: "/events", label: "Events" },
  { to: "/temples", label: "Temples" },
  { to: "/directory", label: "Directory" },
  { to: "/associations", label: "Associations" },
  { to: "/people", label: "People" },
] as const;

const ABOUT = [
  { to: "/epaper", label: "E-Paper" },
  { to: "/submit", label: "Submit a Story" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact & Advertise" },
] as const;

export function SiteFooter() {
  const { lang } = useLang();
  return (
    <footer className="mt-12 border-t-4 border-primary bg-ink text-background">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <h3 className="text-lg text-background">Bay Area Telugu Times</h3>
          <p className="mt-2 text-xs text-background/70">
            News, culture and community coverage for Telugu families across the Bay Area.
          </p>
          <p className="mt-2 text-xs text-background/70">news@bayarea.telugutimes.net</p>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-background/90">
            Sections
          </h4>
          <ul className="mt-2 space-y-1.5 text-xs">
            {CATEGORIES.slice(0, 6).map((c) => (
              <li key={c.slug}>
                <Link
                  to="/category/$category"
                  params={{ category: c.slug }}
                  className="text-background/70 hover:text-background"
                >
                  {lang === "te" ? c.te : c.en}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-background/90">
            Community
          </h4>
          <ul className="mt-2 space-y-1.5 text-xs">
            {COMMUNITY.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="text-background/70 hover:text-background">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-background/90">
            About
          </h4>
          <ul className="mt-2 space-y-1.5 text-xs">
            {ABOUT.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="text-background/70 hover:text-background">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            <a href={TT_LINKS.site} target="_blank" rel="noreferrer" className="text-background/70 hover:text-background">
              TeluguTimes.net
            </a>
            <a href={TT_LINKS.instagram} target="_blank" rel="noreferrer" className="text-background/70 hover:text-background">
              Instagram
            </a>
            <a href={TT_LINKS.facebook} target="_blank" rel="noreferrer" className="text-background/70 hover:text-background">
              Facebook
            </a>
            <a href={TT_LINKS.youtube} target="_blank" rel="noreferrer" className="text-background/70 hover:text-background">
              YouTube
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-background/15 py-4 text-center text-xs text-background/60">
        <p>© {new Date().getFullYear()} Bay Area Telugu Times. All rights reserved.</p>
      </div>
    </footer>
  );
}
