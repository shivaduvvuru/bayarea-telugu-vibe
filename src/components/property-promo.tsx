import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin } from "lucide-react";
import { getFeaturedCampaign } from "@/lib/property.functions";
import { campaignPath, eventDateLabel, promoVisible } from "@/lib/property";
import { cn } from "@/lib/utils";

/**
 * Compact homepage module for the running property-show campaign. It hides
 * itself when no campaign is scheduled or the campaign window has closed, so
 * the homepage never carries a stale promotion.
 */
export function PropertyPromo({ className }: { className?: string }) {
  const { data } = useQuery({
    queryKey: ["property", "featured-campaign"],
    queryFn: () => getFeaturedCampaign(),
    staleTime: 30 * 60 * 1000,
  });

  const campaign = data?.campaign;
  if (!campaign || !promoVisible(campaign)) return null;

  const dates = eventDateLabel(campaign);
  const projects = data?.properties.length ?? 0;

  return (
    <Link
      to={campaignPath(campaign.slug)}
      className={cn(
        "lift block rounded-lg border border-primary/30 bg-surface-tint p-3.5",
        className,
      )}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
        Property focus
      </p>
      <h3 className="mt-1 text-[17px] font-bold leading-snug text-ink">
        {campaign.promo_title ?? campaign.name}
      </h3>
      {campaign.promo_line ? (
        <p className="mt-1 text-sm text-muted-foreground">{campaign.promo_line}</p>
      ) : null}
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {dates ? (
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            {dates}
          </span>
        ) : null}
        {campaign.venue ? (
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {campaign.venue}
          </span>
        ) : null}
      </p>
      <span className="mt-2 inline-block text-xs font-bold text-primary">
        {projects > 0 ? `Browse ${projects} projects →` : "See the details →"}
      </span>
    </Link>
  );
}
