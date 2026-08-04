import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listPosts } from "@/lib/wp.functions";
import { formatDate, isLocal, type Article } from "@/lib/wp";
import { canonical } from "@/lib/site";

const TITLE = "Bay Area Telugu Times Lite — fast local Telugu news";
const DESC =
  "A lightweight, story-first edition of Bay Area Telugu Times: local news, events and community for the San Francisco Bay Area.";
const URL = canonical("/lite");

/** Single snapshot read — no database, temple, politics or RSS calls. */
const liteQuery = queryOptions({
  queryKey: ["lite", "posts"],
  queryFn: () => listPosts({ data: { perPage: 30, instant: true, compact: true } }),
  staleTime: 30 * 60 * 1000,
});

export const Route = createFileRoute("/lite")({
  loader: ({ context }) => context.queryClient.ensureQueryData(liteQuery),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: LiteHome,
});

function Lead({ a }: { a: Article }) {
  return (
    <Link to="/article/$slug" params={{ slug: a.slug }} className="block">
      {a.image ? (
        <img
          src={a.image}
          alt=""
          width={960}
          height={540}
          fetchPriority="high"
          decoding="async"
          className="aspect-[16/9] w-full rounded-md object-cover"
        />
      ) : null}
      <h2 className="mt-2 text-[22px] font-bold leading-snug text-ink">{a.title}</h2>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.excerpt}</p>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        {a.categoryName} · {formatDate(a.date)}
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
        <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
          {a.categoryName} · {formatDate(a.date)}
        </p>
      </div>
      {a.image ? (
        <img
          src={a.image}
          alt=""
          width={112}
          height={84}
          loading="lazy"
          decoding="async"
          className="h-[72px] w-[104px] shrink-0 rounded object-cover"
        />
      ) : null}
    </Link>
  );
}

function LiteHome() {
  const { data: articles } = useSuspenseQuery(liteQuery);
  const local = articles.filter(isLocal);
  const lead = local[0] ?? articles[0];

  if (!lead) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-ink">No stories yet</h1>
      </div>
    );
  }

  const rest = articles.filter((a) => a.slug !== lead.slug);
  const localRest = rest.filter(isLocal).slice(0, 8);
  const more = rest.filter((a) => !localRest.includes(a)).slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl px-3 py-3">
      <h1 className="sr-only">Bay Area Telugu Times Lite</h1>
      <Lead a={lead} />

      <section className="mt-5">
        <h2 className="mb-1 border-b-2 border-primary pb-1 text-sm font-bold uppercase tracking-wide text-ink">
          Bay Area
        </h2>
        {localRest.map((a) => (
          <Row key={a.slug} a={a} />
        ))}
      </section>

      <section className="mt-5">
        <h2 className="mb-1 border-b-2 border-primary pb-1 text-sm font-bold uppercase tracking-wide text-ink">
          More news
        </h2>
        {more.map((a) => (
          <Row key={a.slug} a={a} />
        ))}
      </section>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        <Link to="/" className="underline">
          Switch to the full edition
        </Link>
      </p>
    </div>
  );
}