import { TT_LINKS } from "@/lib/network-links";
import { Link } from "@tanstack/react-router";
import { CATEGORIES } from "@/lib/wp";
import { useLang } from "@/lib/language";

export function SiteFooter() {
  const { lang } = useLang();
  return (
    <footer className="mt-16 border-t-4 border-primary bg-ink text-background">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 md:grid-cols-4">
        <div className="sm:col-span-2">
          <h3 className="text-xl text-background">Bay Area Telugu Times</h3>
          <p className="mt-3 max-w-sm text-sm text-background/70">
            News, culture and community coverage for Telugu families across San Francisco,
            San Jose, Fremont, Milpitas and the wider Bay Area.
          </p>
          <p className="mt-4 text-sm text-background/70">
            news@bayarea.telugutimes.net
          </p>
        </div>
        <div>
          <h4 className="text-sm font-bold uppercase tracking-wider text-background/90">
            Sections
          </h4>
          <ul className="mt-3 space-y-2 text-sm">
            {CATEGORIES.map((c) => (
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
          <h4 className="text-sm font-bold uppercase tracking-wider text-background/90">
            More
          </h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link to="/" className="text-background/70 hover:text-background">
                Home
              </Link>
            </li>
            <li>
              <Link to="/about" className="text-background/70 hover:text-background">
                About
              </Link>
            </li>
            <li>
              <Link to="/directory" className="text-background/70 hover:text-background">
                Community Directory
              </Link>
            </li>
            <li>
              <Link to="/epaper" className="text-background/70 hover:text-background">
                E-Paper
              </Link>
            </li>
            <li>
              <a
                href={TT_LINKS.epaper}
                target="_blank"
                rel="noreferrer"
                className="text-background/70 hover:text-background"
              >
                TeluguTimes.net E-Paper
              </a>
            </li>
            <li>
              <a
                href={TT_LINKS.site}
                target="_blank"
                rel="noreferrer"
                className="text-background/70 hover:text-background"
              >
                TeluguTimes.net
              </a>
            </li>
            <li>
              <a
                href={TT_LINKS.instagram}
                target="_blank"
                rel="noreferrer"
                className="text-background/70 hover:text-background"
              >
                Instagram
              </a>
            </li>
            <li>
              <a
                href={TT_LINKS.facebook}
                target="_blank"
                rel="noreferrer"
                className="text-background/70 hover:text-background"
              >
                Facebook
              </a>
            </li>
            <li>
              <a
                href={TT_LINKS.youtube}
                target="_blank"
                rel="noreferrer"
                className="text-background/70 hover:text-background"
              >
                YouTube
              </a>
            </li>
            <li>
              <Link to="/events" className="text-background/70 hover:text-background">
                Events Calendar
              </Link>
            </li>
            <li>
              <Link to="/temples" className="text-background/70 hover:text-background">
                Temple Announcements
              </Link>
            </li>
            <li>
              <Link to="/foundation-icons" className="text-background/70 hover:text-background">
                Foundation Icons
              </Link>
            </li>
            <li>
              <Link to="/bay-area-icons" className="text-background/70 hover:text-background">
                Bay Area Icons
              </Link>
            </li>
            <li>
              <Link to="/people" className="text-background/70 hover:text-background">
                Community People
              </Link>
            </li>
            <li>
              <Link to="/associations" className="text-background/70 hover:text-background">
                Associations
              </Link>
            </li>
            <li>
              <Link to="/contact" className="text-background/70 hover:text-background">
                Contact & Advertise
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-background/15 py-5 text-center text-xs text-background/60">
        <p>© {new Date().getFullYear()} Bay Area Telugu Times. All rights reserved.</p>
      </div>
    </footer>
  );
}