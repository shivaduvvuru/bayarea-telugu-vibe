import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { listPosts } from "@/lib/content.functions";
import { listTempleAnnouncements } from "@/lib/temples.functions";
import { listPolitics } from "@/lib/politics.functions";
import { listCommunityItems } from "@/lib/cms.functions";
import { upcomingEvents } from "@/lib/news-data";
import { formatDate, isLocal, type Article } from "@/lib/content";
import { canonical } from "@/lib/site";
import { HousingHero } from "@/components/housing-hero";
import { DigestNote, SourceChip } from "@/components/source-credit";
import { Thumb } from "@/components/news";

const TITLE = "Bay Area Telugu Times — Digest of newspapers & journals";
const DESC =
  "A daily digest of newspapers and journals for the Bay Area Telugu community: every headline credits its publisher and links to the original report.";
const HOME_URL = canonical("/");

/** Single snapshot read — no database, temple, politics or RSS calls. */
const homeQuery = queryOptions({
  queryKey: ["home", "posts"],
  queryFn: () => listPosts({ data: { perPage: 40, compact: true } }),
  staleTime: 30 * 60 * 1000,
});

/**
 * Same feed the City News section shows, so the home digest and /category/city-news
 * always carry the identical stories and pictures.
 */
const cityNewsQuery = queryOptions({
  queryKey: ["wp", "posts", "city-news"],
  queryFn: () => listPosts({ data: { category: "city-news", perPage: 24, compact: true } }),
  staleTime: 30 * 60 * 1000,
});

/** Community-submitted and editor-published items from the newsroom CMS. */
const communityQuery = queryOptions({
  queryKey: ["cms", "community", "home"],
  queryFn: () => listCommunityItems({ data: { limit: 8 } }),
  staleTime: 5 * 60 * 1000,
});

/** Pulled straight from temple websites — independent of the newsroom feed. */
const templeQuery = queryOptions({
  queryKey: ["temples", "announcements"],
  queryFn: () => listTempleAnnouncements(),
  staleTime: 30 * 60 * 1000,
});

/** City-hall and Indian political headlines, pulled from publisher feeds. */
const politicsQuery = queryOptions({
  queryKey: ["politics", "all"],
  queryFn: () => listPolitics(),
  staleTime: 30 * 60 * 1000,
});


export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(homeQuery),
      context.queryClient.ensureQueryData(cityNewsQuery),
    ]);
  },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: HOME_URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: HOME_URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: TITLE,
          description: DESC,
          url: HOME_URL,
        }),
      },
    ],
  }),
  component: Home,
  pendingComponent: () => (
    <div className="mx-auto max-w-3xl px-3 py-6">
      <div className="aspect-[4/3] w-full animate-pulse rounded-2xl bg-muted sm:aspect-[16/9]" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  ),
  errorComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-ink">Today's edition didn't load</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Please refresh, or browse sections from the menu below.
      </p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-ink">No stories yet</h1>
    </div>
  ),
});


function Lead({ a }: { a: Article }) {
  return (
    <Link to="/article/$slug" params={{ slug: a.slug }} className="block">
      <div className="overflow-hidden rounded-md">
        <Thumb article={a} priority sizes="(max-width: 768px) 100vw, 720px" />
      </div>
      <h2 className="mt-2 text-[22px] font-bold leading-snug text-ink">{a.title}</h2>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.excerpt}</p>
      <p className="mt-1.5 flex flex-wrap items-center gap-2">
        <SourceChip article={a} />
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {a.categoryName} · {formatDate(a.date)}
        </span>
      </p>
    </Link>
  );
}

function Row({ a }: { a: Article }) {
  return (
    <Link
      to="/article/$slug"
      params={{ slug: a.slug }}
      className="flex gap-3 border-b border-border py-3 last:border-0"
    >
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-3 text-[15px] font-semibold leading-snug text-ink">
          {a.title}
        </h3>
        <p className="mt-1 flex flex-wrap items-center gap-2">
          <SourceChip article={a} />
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {a.categoryName} · {formatDate(a.date)}
          </span>
        </p>
      </div>
      {/* Same picture treatment as City News: photo when we have one,
          otherwise the typographic tile — never an empty slot. */}
      <div className="w-[104px] shrink-0 overflow-hidden rounded [&_figcaption]:hidden">
        <Thumb article={a} sizes="104px" />
      </div>
    </Link>
  );
}

function Head({ children, more }: { children: string; more?: React.ReactNode }) {
  return (
    <h2 className="mb-1 flex items-baseline justify-between gap-2 border-b-2 border-primary pb-1 text-sm font-bold uppercase tracking-wide text-ink">
      <span>{children}</span>
      {more}
    </h2>
  );
}

function MoreTo({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="text-[11px] font-semibold normal-case tracking-normal text-primary underline"
    >
      {label}
    </Link>
  );
}

/** External or CMS link rows keep the same lean look as story rows. */
function LinkRow({
  href,
  title,
  meta,
  internal,
}: {
  href: string;
  title: string;
  meta?: string;
  internal?: boolean;
}) {
  const body = (
    <>
      <h3 className="line-clamp-3 text-[15px] font-semibold leading-snug text-ink">{title}</h3>
      {meta ? (
        <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">{meta}</p>
      ) : null}
    </>
  );
  const cls = "block border-b border-border py-3 last:border-0";
  return internal ? (
    <Link to={href} className={cls}>
      {body}
    </Link>
  ) : (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>
      {body}
    </a>
  );
}

function Home() {
  const { data: articles } = useSuspenseQuery(homeQuery);
  // Identical feed to /category/city-news so both screens carry the same stories.
  const { data: cityNews } = useSuspenseQuery(cityNewsQuery);
  // Fresh, non-blocking reads: these stream in after the snapshot first paint.
  const { data: communityItems = [] } = useQuery(communityQuery);
  const { data: templeFeeds = [] } = useQuery(templeQuery);
  const { data: politicsGroups = [] } = useQuery(politicsQuery);

  const local = cityNews.length ? cityNews : articles.filter(isLocal);
  const lead = local[0] ?? articles[0];

  if (!lead) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-ink">No stories yet</h1>
      </div>
    );
  }

  const localRest = local.filter((a) => a.slug !== lead.slug).slice(0, 8);
  const shown = new Set([lead.slug, ...localRest.map((a) => a.slug)]);
  const more = articles.filter((a) => !shown.has(a.slug)).slice(0, 12);

  const events = upcomingEvents().slice(0, 5);
  // Feeds sometimes repeat the same link (or point at the site root), which both
  // duplicated rows and tripped React's key warning.
  const uniqueBy = <T,>(list: T[], key: (item: T) => string) => {
    const seen = new Set<string>();
    return list.filter((item) => {
      const k = key(item);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };
  const templeNews = uniqueBy(
    templeFeeds.flatMap((f) => f.announcements.map((a) => ({ ...a, temple: f.name }))),
    (a) => `${a.temple}|${a.title}`,
  ).slice(0, 6);
  const politics = uniqueBy(
    politicsGroups.flatMap((g) => g.stories.slice(0, 2)),
    (s) => s.title,
  ).slice(0, 6);

  return (
    <div className="mx-auto max-w-3xl px-3 py-3">
      <h1 className="sr-only">Bay Area Telugu Times — digest of newspapers and journals</h1>

      <div className="mb-3 rounded-md border border-border bg-surface-tint px-3 py-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
          Digest from sources
        </p>
        <DigestNote className="mt-0.5" />
      </div>

      <HousingHero />

      <section className="mt-6">
        <Head more={<MoreTo to="/category/city-news" label="All city news" />}>Bay Area digest</Head>
        <Lead a={lead} />
        <div className="mt-4">
          {localRest.map((a) => (
            <Row key={a.slug} a={a} />
          ))}
        </div>
      </section>

      {communityItems.length > 0 && (
        <section className="mt-5">
          <Head more={<MoreTo to="/connect" label="Community" />}>From the community</Head>
          {communityItems.map((item) => (
            <LinkRow
              key={item.id}
              href={item.link_url ?? "/connect"}
              internal={!item.link_url || item.link_url.startsWith("/")}
              title={item.title}
              meta={[item.city, item.kind].filter(Boolean).join(" · ")}
            />
          ))}
        </section>
      )}

      {events.length > 0 && (
        <section className="mt-5">
          <Head more={<MoreTo to="/events" label="All events" />}>Upcoming events</Head>
          {events.map((e) => (
            <LinkRow
              key={e.id}
              href="/events"
              internal
              title={e.title}
              meta={`${e.city} · ${formatDate(e.start)}`}
            />
          ))}
        </section>
      )}

      {templeNews.length > 0 && (
        <section className="mt-5">
          <Head more={<MoreTo to="/temples" label="All temples" />}>Temple announcements</Head>
          {templeNews.map((a, i) => (
            <LinkRow key={`${a.url}-${i}`} href={a.url} title={a.title} meta={a.temple} />
          ))}
        </section>
      )}

      {politics.length > 0 && (
        <section className="mt-5">
          <Head more={<MoreTo to="/politics" label="More politics" />}>Politics</Head>
          {politics.map((s, i) => (
            <LinkRow
              key={`${s.url}-${i}`}
              href={s.url}
              title={s.title}
              meta={[s.publisher, s.date ? formatDate(s.date) : ""].filter(Boolean).join(" · ")}
            />
          ))}
        </section>
      )}


      <section className="mt-5">
        <Head>More news</Head>
        {more.map((a) => (
          <Row key={a.slug} a={a} />
        ))}
      </section>
    </div>
  );

}
