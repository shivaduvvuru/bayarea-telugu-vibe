import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listPolitics, type PoliticsGroupDTO } from "@/lib/politics.functions";
import { POLITICS_REGIONS } from "@/lib/politics-sources";
import { RelativeDate } from "@/components/news";
import { CommunityAppeal } from "@/components/ads";

const TITLE = "Bay Area City Politics & Indian Political News | Telugu Times";
const DESC =
  "City council, mayor and election news from all 16 Bay Area cities, plus Andhra Pradesh, Telangana, national Indian politics and Indian-American candidates.";

const politicsQuery = queryOptions({
  queryKey: ["politics", "all"],
  queryFn: () => listPolitics(),
  staleTime: 30 * 60 * 1000,
});

export const Route = createFileRoute("/politics")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(politicsQuery),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center" role="alert">
      <p className="text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <p className="text-sm text-muted-foreground">No political news right now.</p>
    </div>
  ),
  component: PoliticsPage,
});

function Group({ group }: { group: PoliticsGroupDTO }) {
  return (
    <article className="border border-border bg-card p-5">
      <h3 className="text-base font-bold text-ink">{group.place}</h3>
      <ul className="mt-3 space-y-3">
        {group.stories.slice(0, 6).map((s) => (
          <li key={s.url}>
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold leading-snug text-foreground hover:text-primary"
            >
              {s.title}
            </a>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {s.publisher}
              {s.publisher && s.date ? " \u00b7 " : ""}
              {s.date && <RelativeDate iso={s.date} />}
            </p>
          </li>
        ))}
      </ul>
    </article>
  );
}

function PoliticsPage() {
  const { data } = useSuspenseQuery(politicsQuery);
  const regions = POLITICS_REGIONS.map((region) => ({
    region,
    groups: data.filter((g) => g.region === region),
  })).filter((r) => r.groups.length > 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Political</p>
      <h1 className="mt-2 text-3xl font-bold text-ink md:text-4xl">
        City Hall &amp; Indian Politics
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] text-muted-foreground">
        Council votes, mayors, ballot measures and school boards across the 16 Bay Area cities
        our community lives in &mdash; followed by Andhra Pradesh, Telangana, national Indian
        politics and Indian-American candidates. Headlines link straight to the publisher.
      </p>

      {regions.length === 0 && (
        <p className="mt-10 text-muted-foreground">
          Political headlines are being refreshed. Please check back shortly.
        </p>
      )}

      {regions.map(({ region, groups }) => (
        <section key={region} className="mt-10">
          <h2 className="border-b-2 border-primary pb-2 text-xl font-bold text-ink">{region}</h2>
          <div className="mt-5 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => (
              <Group key={g.id} group={g} />
            ))}
          </div>
        </section>
      ))}

      <CommunityAppeal what="civic and political updates" />
    </div>
  );
}