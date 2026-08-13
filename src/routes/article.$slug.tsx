import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { articleLang, formatDate } from "@/lib/content";
import { getPostBySlug, listPosts } from "@/lib/content.functions";
import { CategoryTag, LangBadge, ListRow, SectionHeading } from "@/components/news";

const articleQuery = (slug: string) =>
  queryOptions({
    queryKey: ["wp", "post", slug],
    queryFn: () => getPostBySlug({ data: { slug } }),
  });

const moreQuery = queryOptions({
  queryKey: ["wp", "posts", "latest"],
  queryFn: () => listPosts({ data: { perPage: 24 } }),
});

export const Route = createFileRoute("/article/$slug")({
  loader: async ({ params, context }) => {
    const article = await context.queryClient.ensureQueryData(articleQuery(params.slug));
    if (!article) throw notFound();
    context.queryClient.prefetchQuery(moreQuery);
    return { article };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Unavailable" }, { name: "robots", content: "noindex" }] };
    }
    const { article } = loaderData;
    const title = `${article.title} — Bay Area Telugu Times`;
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: article.excerpt },
      { property: "og:title", content: title },
      { property: "og:description", content: article.excerpt },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (article.image) {
      meta.push({ property: "og:image", content: article.image });
      meta.push({ name: "twitter:image", content: article.image });
    }
    const url = `https://bayarea-telugu-vibe.lovable.app/article/${article.slug}`;
    return {
      meta: [...meta, { property: "og:url", content: url }],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            headline: article.title,
            description: article.excerpt,
            datePublished: article.date,
            dateModified: article.date,
            mainEntityOfPage: url,
            articleSection: article.categoryName,
            ...(article.image ? { image: [article.image] } : {}),
            author: { "@type": "Person", name: article.author },
            publisher: {
              "@type": "NewsMediaOrganization",
              name: "Bay Area Telugu Times",
              url: "https://bayarea-telugu-vibe.lovable.app",
            },
          }),
        },
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
      <h1 className="text-2xl font-bold text-ink">Story not found</h1>
    </div>
  ),
  component: ArticlePage,
});

function ArticlePage() {
  const { article } = Route.useLoaderData();
  const { data: latest } = useSuspenseQuery(moreQuery);
  const related = latest.filter((a) => a.slug !== article.slug).slice(0, 8);

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-8 lg:grid-cols-[2fr_1fr]">
      <article>
        <CategoryTag article={article} />
        <h1
          className={`mt-3 text-3xl leading-tight font-bold text-ink md:text-4xl ${
            articleLang(article) === "te" ? "te-text" : ""
          }`}
        >
          {article.title}
        </h1>
        {article.sourceName && (
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="rounded-sm bg-primary px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary-foreground">
              Digest
            </span>
            <span className="text-muted-foreground">Reported by</span>
            {article.sourceUrl ? (
              <a
                href={article.sourceUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="font-bold text-primary underline"
              >
                {article.sourceName}
              </a>
            ) : (
              <span className="font-bold text-ink">{article.sourceName}</span>
            )}
          </p>
        )}
        <div className="mt-4 border-y border-border py-3 text-sm text-muted-foreground">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-ink">{article.author}</span>
            <span aria-hidden>·</span>
            <span>Published {formatDate(article.date)}</span>
            <span aria-hidden>·</span>
            <span>Updated {formatDate(article.date)}</span>
            <LangBadge article={article} />
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="font-semibold text-ink">Bay Area Telugu Times newsroom</span>
            {article.category === "community" && (
              <span className="border border-border px-1.5 py-0.5 font-semibold">
                Community submission
              </span>
            )}
            <span aria-hidden>·</span>
            <Link to="/contact" className="font-semibold text-primary">
              Report a correction
            </Link>
          </p>
        </div>
        {article.image && (
          <figure className="mt-5">
            <img
              src={article.image}
              alt={article.title}
              width={1200}
              height={675}
              decoding="async"
              referrerPolicy="no-referrer-when-downgrade"
              className={
                article.category === "gallery"
                  ? "max-h-[80vh] w-full bg-surface-tint object-contain"
                  : "aspect-[16/9] w-full object-cover"
              }
            />
            {article.sourceName && (
              <figcaption className="mt-1.5 text-xs text-muted-foreground">
                Photo: {article.sourceName}
                {article.sourceUrl && (
                  <>
                    {" — "}
                    <a
                      href={article.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="font-semibold text-primary"
                    >
                      view original
                    </a>
                  </>
                )}
              </figcaption>
            )}
          </figure>
        )}
        <div
          className="wp-content mt-6 space-y-4 text-[17px] leading-relaxed text-foreground"
          dangerouslySetInnerHTML={{ __html: article.html }}
        />
        {article.sourceUrl && (
          <p className="mt-6 border-t border-border pt-3 text-sm text-muted-foreground">
            Source:{" "}
            <a
              href={article.sourceUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="font-semibold text-primary"
            >
              {article.sourceName ?? "Read the original report"}
            </a>
            . Summary and artwork credited to the original publisher.
          </p>
        )}
        <Link
          to="/category/$category"
          params={{ category: article.category }}
          className="mt-8 inline-block rounded-sm border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
        >
          More in this section
        </Link>
      </article>

      <aside>
        <SectionHeading te="ఇతర వార్తలు" en="More" />
        <ul>
          {related.map((a) => (
            <ListRow key={a.id} article={a} />
          ))}
        </ul>
      </aside>
    </div>
  );
}
