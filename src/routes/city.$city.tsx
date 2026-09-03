import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listDirectory } from "@/lib/content.functions";
import { listClaimOverrides } from "@/lib/claims.functions";
import { listThreads } from "@/lib/forum.functions";
import { listTempleAnnouncements } from "@/lib/temples.functions";
import { CITY_REGIONS } from "@/lib/content";
import { resolveCity, regionOf } from "@/lib/directory-city";
import { upcomingEvents } from "@/lib/news-data";
import { EventStrip } from "@/components/events";
import { SectionHeading } from "@/components/news";
import { categoryLabel } from "@/lib/forum";
import { CityDigestSignup } from "@/components/city-digest";

const CITIES = CITY_REGIONS.flatMap((r) => r.cities.map((c) => ({ ...c, region: r.en })));

const hubQuery = (city: string) =>
  queryOptions({
    queryKey: ["city-hub", city],
    queryFn: async () => {
      const [listings, overrides, threads, temples] = await Promise.all([
        listDirectory(),
        listClaimOverrides(),
        listThreads({ data: { city, limit: 12 } }),
        listTempleAnnouncements(),
      ]);
      return { listings, overrides, threads, temples };
    },
    staleTime: 10 * 60 * 1000,
  });

export const Route = createFileRoute("/city/$city")({
  loader: async ({ context, params }) => {
    const match = CITIES.find((c) => c.slug === params.city);
    if (!match) throw notFound();
    await context.queryClient.ensureQueryData(hubQuery(match.en));
    return { city: match };
  },
  head: ({ loaderData }) => {
    const name = loaderData?.city.en ?? "Bay Area";
    const title = `${name} Indian community — businesses, events & discussions`;
    const description = `Telugu businesses, temples, upcoming events and neighbourhood discussions in ${name}, ${loaderData?.city.region ?? "the Bay Area"}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center" role="alert">
      <p className="text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <p className="text-sm text-muted-foreground">We do not cover that city yet.</p>
      <Link to="/directory" className="mt-4 inline-block text-sm font-semibold text-primary">
        Browse the directory
      </Link>
    </div>
  ),
  component: CityHub,
});

function CityHub() {
  const { city } = Route.useLoaderData();
  const { data } = useSuspenseQuery(hubQuery(city.en));

  const overrideCity = new Map(
    data.overrides.filter((o) => o.city).map((o) => [o.listing_id, o.city!] as const),
  );
  const listings = data.listings.filter(
    (e) => (overrideCity.get(e.id) ?? resolveCity(e.title, e.excerpt)) === city.en,
  );
  const events = upcomingEvents().filter((e) => e.city === city.en);
  const temples = data.temples.filter((t) => t.city === city.en);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">
        {city.region}
      </p>
      <h1 className="mt-2 text-3xl font-bold text-ink md:text-4xl">
        {city.en}
        <span className="te-text mt-1 block text-sm font-medium text-muted-foreground">
          {city.te}
        </span>
      </h1>
      <p className="mt-3 text-[15px] text-muted-foreground">
        Everything we track in {city.en}: community businesses, temples, upcoming events and
        neighbourhood discussions.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          to="/category/$category"
          params={{ category: city.slug }}
          className="min-h-11 rounded-sm border border-border px-4 py-2.5 text-sm font-semibold text-ink hover:border-primary"
        >
          {city.en} news
        </Link>
        <Link
          to="/forums"
          className="min-h-11 rounded-sm border border-border px-4 py-2.5 text-sm font-semibold text-ink hover:border-primary"
        >
          Forums
        </Link>
        <Link
          to="/events"
          className="min-h-11 rounded-sm border border-border px-4 py-2.5 text-sm font-semibold text-ink hover:border-primary"
        >
          Events calendar
        </Link>
        <Link
          to="/directory"
          className="min-h-11 rounded-sm border border-border px-4 py-2.5 text-sm font-semibold text-ink hover:border-primary"
        >
          Full directory
        </Link>
      </div>

      <section className="mt-10">
        <SectionHeading en={`Upcoming events in ${city.en}`} te="రాబోయే ఈవెంట్స్" />
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No events listed in {city.en} right now.{" "}
            <Link to="/submit" className="font-semibold text-primary">
              Add yours
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-3">
            {events.slice(0, 6).map((e) => (
              <EventStrip key={e.id} event={e} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <SectionHeading en={`Discussions about ${city.en}`} te="చర్చలు" />
        {data.threads.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No {city.en} discussions yet.{" "}
            <Link to="/forums" className="font-semibold text-primary">
              Start one
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-2">
            {data.threads.map((t) => (
              <li key={t.id} className="border border-border bg-card p-4">
                <Link
                  to="/forums/thread/$threadId"
                  params={{ threadId: t.id }}
                  className="font-semibold headline-link"
                >
                  {t.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {categoryLabel(t.category).en} · {t.reply_count} replies
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <SectionHeading en={`Temples in ${city.en}`} te="ఆలయాలు" />
        {temples.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No temple tracked in {city.en} yet —{" "}
            <Link to="/temples" className="font-semibold text-primary">
              see all Bay Area temples
            </Link>
            .
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {temples.map((t) => (
              <article key={t.id} className="border border-border bg-card p-4">
                <h3 className="text-base font-bold text-ink">{t.name}</h3>
                <ul className="mt-2 space-y-1">
                  {t.announcements.slice(0, 4).map((a) => (
                    <li key={a.title} className="text-sm leading-snug">
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="headline-link">
                        {a.title}
                      </a>
                    </li>
                  ))}
                </ul>
                <a
                  href={t.site}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-sm font-semibold text-primary"
                >
                  Temple website
                </a>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <SectionHeading en={`Businesses & organisations in ${city.en}`} te="వ్యాపారాలు" />
        {listings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing listed in {city.en} yet.{" "}
            <Link to="/directory" className="font-semibold text-primary">
              Claim or add a listing
            </Link>
            .
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((e) => (
              <article key={e.id} className="border border-border bg-card p-4">
                <h3 className="text-base font-bold text-ink">{e.title}</h3>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-primary">
                  {[e.category, regionOf(city.en)].filter(Boolean).join(" · ")}
                </p>
                {e.excerpt && (
                  <p className="mt-2 text-sm text-muted-foreground">{e.excerpt}</p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <CityDigestSignup city={city.en} />
    </div>
  );
}
