import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { listCommunityItems } from "@/lib/cms.functions";
import { isTempleNewsClean } from "@/lib/temple-purity";

const TITLE = "Bay Area Temple News — announcements & coverage";
const DESC =
  "Auto-published announcements and coverage from Bay Area Hindu temples: festivals, program changes, fundraisers and community notices.";
const URL = "https://bayarea-telugu-vibe.lovable.app/temples/news";

export const Route = createFileRoute("/temples/news")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: TempleNewsPage,
});

/**
 * Temple news publishes automatically (no approval) and lands as an
 * announcement in the "temples" category.
 */
const templeNewsQuery = queryOptions({
  queryKey: ["cms", "temple-news"],
  queryFn: () => listCommunityItems({ data: { kind: "announcement", limit: 80 } }),
  staleTime: 10 * 60 * 1000,
});

function TempleNewsPage() {
  const { data = [], isLoading } = useQuery(templeNewsQuery);
  const rows = data
    .filter((r) => (r.category ?? "").toLowerCase() === "temples")
    .filter((r) =>
      isTempleNewsClean({ title: r.title, summary: r.summary, sourceUrl: r.link_url }),
    )
    .slice(0, 40);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:py-8">
      <h1 className="text-3xl font-bold text-ink">Temple News</h1>
      <p className="mt-2 text-base text-muted-foreground">
        Announcements and coverage from Bay Area temples, published automatically as they arrive.
      </p>

      {isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading temple news…</p>}

      {!isLoading && rows.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No temple announcements yet. Browse the{" "}
            <Link to="/temples/calendar" className="font-semibold text-primary">
              Temple Calendar
            </Link>{" "}
            for upcoming programs.
          </p>
        </div>
      )}

      <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">
        {rows.map((r) => (
          <li key={r.id} className="flex items-start gap-3 p-3">
            {r.image_url && (
              <img
                src={r.image_url}
                alt={r.title}
                loading="lazy"
                className="h-16 w-16 flex-none rounded-md object-cover"
              />
            )}
            <div className="min-w-0">
              {r.link_url ? (
                <a
                  href={r.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-base font-semibold text-ink"
                >
                  {r.title}
                </a>
              ) : (
                <span className="text-base font-semibold text-ink">{r.title}</span>
              )}
              {r.summary && (
                <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{r.summary}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
