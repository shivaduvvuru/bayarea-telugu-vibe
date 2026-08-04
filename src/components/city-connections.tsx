import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listDirectory } from "@/lib/wp.functions";
import { listClaimOverrides } from "@/lib/claims.functions";
import { resolveCity, regionOf } from "@/lib/directory-city";
import { upcomingEvents } from "@/lib/news-data";
import { eventDate } from "@/lib/news-data";
import { CITY_REGIONS } from "@/lib/wp";

const slugOf = (city: string) =>
  CITY_REGIONS.flatMap((r) => r.cities).find((c) => c.en === city)?.slug ?? null;

/**
 * Cross-links a city-tagged surface (a forum thread, an article) to the
 * businesses and events we track in the same city.
 */
export function CityConnections({ city }: { city: string }) {
  const slug = slugOf(city);
  const { data } = useQuery({
    queryKey: ["city-connections", city],
    queryFn: async () => {
      const [listings, overrides] = await Promise.all([listDirectory(), listClaimOverrides()]);
      const override = new Map(
        overrides.filter((o) => o.city).map((o) => [o.listing_id, o.city!] as const),
      );
      return listings.filter(
        (e) => (override.get(e.id) ?? resolveCity(e.title, e.excerpt)) === city,
      );
    },
    staleTime: 10 * 60 * 1000,
  });

  const events = upcomingEvents().filter((e) => e.city === city).slice(0, 3);
  const businesses = (data ?? []).slice(0, 5);
  if (!slug) return null;

  return (
    <aside className="mt-8 border border-border bg-surface-tint p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">
        {regionOf(city)}
      </p>
      <h2 className="mt-1 text-lg font-bold text-ink">More in {city}</h2>

      {events.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Upcoming events
          </h3>
          <ul className="mt-2 space-y-1.5">
            {events.map((e) => {
              const d = eventDate(e);
              return (
                <li key={e.id} className="text-sm">
                  <Link to="/events" className="font-semibold headline-link">
                    {e.title}
                  </Link>
                  {d && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {businesses.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {city} businesses & organisations
          </h3>
          <ul className="mt-2 space-y-1.5">
            {businesses.map((b) => (
              <li key={b.id} className="text-sm text-foreground">
                {b.title}
                {b.category && (
                  <span className="ml-2 text-xs text-muted-foreground">{b.category}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link
        to="/city/$city"
        params={{ city: slug }}
        className="mt-4 inline-block min-h-11 rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        Open the {city} hub
      </Link>
    </aside>
  );
}
