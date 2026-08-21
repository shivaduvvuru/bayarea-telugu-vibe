import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search as SearchIcon } from "lucide-react";
import { searchPosts } from "@/lib/content.functions";
import { StoryCard } from "@/components/news";
import { useLang } from "@/lib/language";

const TITLE = "Search — Times Bay Area";
const DESC =
  "Search Bay Area Telugu news, community announcements, temple programs, events and classifieds.";

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>) => ({
    q: typeof s["q"] === "string" ? (s["q"] as string) : "",
  }),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { t } = useLang();
  const { q } = Route.useSearch();
  const [term, setTerm] = useState(q);
  const [query, setQuery] = useState(q);
  const run = useServerFn(searchPosts);

  const { data, isFetching } = useQuery({
    queryKey: ["wp", "search", query],
    queryFn: () => run({ data: { q: query } }),
    enabled: query.trim().length > 1,
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:py-8">
      <h1 className="text-2xl font-bold text-ink">{t("Search", "వెతకండి")}</h1>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(term);
        }}
      >
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          aria-label={t("Search stories", "వార్తల కోసం వెతకండి")}
          placeholder={t("Temples, Fremont, jobs…", "దేవాలయాలు, ఫ్రీమాంట్, ఉద్యోగాలు…")}
          className="min-h-11 flex-1 border border-input px-3 text-base outline-none focus:border-primary"
        />
        <button className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-primary px-4 text-base font-semibold text-primary-foreground hover:bg-primary-dark">
          <SearchIcon className="h-4 w-4" />
          {t("Search", "వెతకండి")}
        </button>
      </form>

      {isFetching && (
        <p className="mt-6 text-base text-muted-foreground">{t("Searching…", "వెతుకుతోంది…")}</p>
      )}
      {data && data.length === 0 && !isFetching && (
        <p className="mt-6 text-base text-muted-foreground">
          {t("No stories matched that search.", "ఫలితాలు కనిపించలేదు.")}
        </p>
      )}
      {data && data.length > 0 && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {data.map((a) => (
            <StoryCard key={a.id} article={a} />
          ))}
        </div>
      )}
    </div>
  );
}
