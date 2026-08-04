import { Link } from "@tanstack/react-router";
import { BadgeCheck, MapPin, Navigation, Globe, Phone } from "lucide-react";
import { directionsUrl, type Temple } from "@/lib/temple-directory";

export function TempleCard({ temple: t }: { temple: Temple }) {
  return (
    <article className="flex flex-col border border-border bg-card p-4">
      <div className="flex min-w-0 items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-bold leading-snug text-ink">
            <Link
              to="/temples/temple/$slug"
              params={{ slug: t.slug }}
              className="headline-link"
            >
              {t.name}
            </Link>
          </h3>
          <p className="mt-1 flex items-start gap-1 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0">{t.address}</span>
          </p>
        </div>
        {t.verified && (
          <span
            className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-primary"
            title={`Verified ${t.last_verified_at}`}
          >
            <BadgeCheck className="h-3.5 w-3.5" /> Verified
          </span>
        )}
      </div>

      <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
        {t.city ?? `Near ${t.nearby_city}`} · {t.region} · {t.temple_type}
      </p>

      {(t.deities.length > 0 || t.traditions.length > 0) && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {[...t.deities, ...t.traditions].slice(0, 5).map((tag) => (
            <li
              key={tag}
              className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {tag}
            </li>
          ))}
        </ul>
      )}

      {t.description && (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t.description}</p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <a
          href={directionsUrl(t.address)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-sm bg-primary px-3 text-sm font-semibold text-primary-foreground"
        >
          <Navigation className="h-4 w-4" /> Directions
        </a>
        <a
          href={t.website}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-sm border border-border px-3 text-sm font-semibold text-ink"
        >
          <Globe className="h-4 w-4" /> Website
        </a>
        {t.phone && (
          <a
            href={`tel:${t.phone.replace(/\s/g, "")}`}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-sm border border-border px-3 text-sm font-semibold text-ink"
          >
            <Phone className="h-4 w-4" /> Call
          </a>
        )}
      </div>
    </article>
  );
}
