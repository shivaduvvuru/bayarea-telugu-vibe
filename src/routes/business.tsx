import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { BarChart3, ExternalLink, Landmark, Cpu, TrendingUp } from "lucide-react";
import { getBusinessBrief, type BizItem } from "@/lib/business-news.functions";
import { SmartImage } from "@/components/smart-image";
import { SectionHeading } from "@/components/news";
import { canonical } from "@/lib/site";
import { formatDate } from "@/lib/content";

const briefQuery = queryOptions({
  queryKey: ["business-brief"],
  queryFn: () => getBusinessBrief(),
  staleTime: 15 * 60 * 1000,
});

const TITLE = "Business News — US Business, Tech & Policy | Times Bay Area";
const DESCRIPTION =
  "The day's most important US business, technology and political headlines, plus the statistic of the day — aggregated via BizToc and Statista, credited and linked to the source.";
const URL = canonical("/business");

export const Route = createFileRoute("/business")({
  loader: ({ context }) => context.queryClient.ensureQueryData(briefQuery),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: BusinessPage,
});

const DESK_META: Record<BizItem["desk"], { label: string; Icon: typeof TrendingUp }> = {
  business: { label: "Business", Icon: TrendingUp },
  tech: { label: "Tech", Icon: Cpu },
  politics: { label: "Politics", Icon: Landmark },
};

function Credit({ item }: { item: BizItem }) {
  return (
    <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {item.publisher ? `${item.publisher} · ` : ""}via{" "}
      <a
        href="https://biztoc.com"
        target="_blank"
        rel="nofollow noopener noreferrer"
        className="text-primary hover:underline"
      >
        biztoc.com
      </a>
      {item.publishedAt ? ` · ${formatDate(item.publishedAt)}` : ""}
    </p>
  );
}

function BusinessPage() {
  const { data } = useSuspenseQuery(briefQuery);
  const lead = data.items.slice(0, 3);
  const rest = data.items.slice(3);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
        Times Bay Area — Business Desk
      </p>
      <h1 className="text-3xl font-bold text-ink">Business News</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        US business, technology and political headlines that matter, with the statistic of the day.
        Headlines aggregated via{" "}
        <a
          href="https://biztoc.com"
          target="_blank"
          rel="nofollow noopener noreferrer"
          className="font-semibold text-primary hover:underline"
        >
          biztoc.com
        </a>
        ; each story links to its original publisher.
      </p>

      {data.stat ? (
        <section className="mt-6 rounded-2xl border border-border bg-surface-tint/50 p-4 sm:p-6">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            <BarChart3 className="h-4 w-4" aria-hidden /> Statistic of the day
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_220px] sm:items-start">
            <div className="min-w-0">
              <a
                href={data.stat.url}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="text-lg font-bold text-ink hover:text-primary sm:text-xl"
              >
                {data.stat.title}
              </a>
              <p className="mt-2 text-sm text-muted-foreground">{data.stat.summary}</p>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Statista · discovered via{" "}
                <a
                  href="https://biztoc.com"
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  biztoc.com
                </a>
              </p>
            </div>
            {data.stat.image ? (
              <SmartImage
                src={data.stat.image}
                alt={data.stat.title}
                loading="lazy"
                decoding="async"
                optimizedWidth={440}
                className="w-full rounded-xl bg-surface-tint object-cover"
              />
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="mt-8">
        <SectionHeading en="Top of the business wire" />
        {data.items.length === 0 ? (
          <p className="text-muted-foreground">The business wire is quiet right now — check back shortly.</p>
        ) : (
          <>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {lead.map((item) => {
                const { label, Icon } = DESK_META[item.desk];
                return (
                  <article key={item.id} className="min-w-0">
                    {item.image ? (
                      <a href={item.url} target="_blank" rel="nofollow noopener noreferrer" className="group block">
                        <SmartImage
                          src={item.image}
                          alt={item.title}
                          loading="lazy"
                          decoding="async"
                          optimizedWidth={640}
                          sizes="(max-width: 640px) 100vw, 33vw"
                          className="aspect-video w-full rounded-xl bg-surface-tint object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                        />
                      </a>
                    ) : null}
                    <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                      <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
                    </p>
                    <h2 className="mt-2 text-lg font-bold leading-snug text-ink">
                      <a href={item.url} target="_blank" rel="nofollow noopener noreferrer" className="hover:text-primary">
                        {item.title}
                      </a>
                    </h2>
                    <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{item.summary}</p>
                    <Credit item={item} />
                  </article>
                );
              })}
            </div>

            {rest.length ? (
              <div className="mt-10">
                <SectionHeading en="In brief" />
                <ul className="grid gap-x-8 sm:grid-cols-2">
                  {rest.map((item) => (
                    <li key={item.id} className="border-b border-border py-3">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="nofollow noopener noreferrer"
                        className="group flex items-start gap-2 text-sm font-semibold text-ink hover:text-primary"
                      >
                        <span className="min-w-0">{item.title}</span>
                        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                      </a>
                      <Credit item={item} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
