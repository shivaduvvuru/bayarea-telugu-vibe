import { Link } from "@tanstack/react-router";
import { BadgeCheck, MapPin } from "lucide-react";
import { priceLabel, propertyPath, type Property } from "@/lib/property";
import { cn } from "@/lib/utils";

/**
 * Project card. Everything shown comes from the stored record — no field is
 * invented, and missing data simply does not render.
 */
export function PropertyCard({
  property: p,
  selected,
  onToggle,
  className,
}: {
  property: Property;
  selected?: boolean;
  onToggle?: (p: Property) => void;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "lift flex flex-col overflow-hidden rounded-lg border border-border bg-card",
        selected && "ring-2 ring-primary",
        className,
      )}
    >
      <Link
        to={propertyPath(p.campaign_slug, p.slug)}
        className="block"
        aria-label={`${p.project_name} by ${p.developer}`}
      >
        <div className="aspect-[16/10] w-full overflow-hidden bg-muted">
          {p.image_url ? (
            <img
              src={p.image_url}
              alt={`${p.project_name} by ${p.developer}`}
              loading="lazy"
              className="h-full w-full object-cover object-top"
            />
          ) : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {p.is_tt_advertiser ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
              Telugu Times partner
            </span>
          ) : null}
          {p.is_credai_participant ? (
            <span className="rounded-full bg-surface-tint px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Show participant
            </span>
          ) : null}
          {p.project_status ? (
            <span className="text-[11px] font-medium text-muted-foreground">{p.project_status}</span>
          ) : null}
        </div>

        <h3 className="text-[17px] font-bold leading-snug text-ink">
          <Link to={propertyPath(p.campaign_slug, p.slug)}>{p.project_name}</Link>
        </h3>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {p.developer}
        </p>

        {p.locality ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {p.locality}
            {p.zone && p.zone !== p.locality ? ` · ${p.zone}` : ""}
          </p>
        ) : null}

        <p className="text-sm font-semibold text-ink">{priceLabel(p)}</p>
        {p.configuration ? (
          <p className="text-xs text-muted-foreground">{p.configuration}</p>
        ) : null}
        {p.rera_number ? (
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <BadgeCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
            RERA {p.rera_number}
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          <Link
            to={propertyPath(p.campaign_slug, p.slug)}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-tint"
          >
            Project details
          </Link>
          {onToggle ? (
            <button
              type="button"
              onClick={() => onToggle(p)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                selected
                  ? "bg-primary text-primary-foreground"
                  : "border border-primary text-primary hover:bg-primary/10",
              )}
            >
              {selected ? "Shortlisted" : "Add to enquiry"}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
