import { useQuery, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SmartImage } from "@/components/smart-image";
import articleFallback from "@/assets/article-fallback-community.jpg";
import { RelativeDate } from "@/components/news";
import { publicBullets, publicText } from "@/lib/public-text";

/**
 * Presentation-only digest. Reads the pre-classified `articles` table directly —
 * no client-side classification, dedupe or rotation timers. Used both by the
 * standalone /digest route and the "Daily Smart Digest" homepage section.
 */
export type Article = {
  id: string;
  title: string;
  summary: string | null;
  summary_bullets: unknown;
  desk: string;
  city: string | null;
  source_name: string | null;
  source_url: string | null;
  image_url: string | null;
  importance_score: number | null;
  published_at: string;
};

const COLUMNS =
  "id,title,summary,summary_bullets,desk,city,source_name,source_url,image_url,importance_score,published_at";

async function fetchLead(): Promise<Article[]> {
  const { data, error } = await supabase
    .from("articles")
    .select(COLUMNS)
    .eq("status", "published")
    .order("importance_score", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data ?? []) as Article[];
}

async function fetchDesk(desk: string, limit: number): Promise<Article[]> {
  const { data, error } = await supabase
    .from("articles")
    .select(COLUMNS)
    .eq("status", "published")
    .eq("desk", desk)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Article[];
}

const leadQuery = queryOptions({
  queryKey: ["articles", "lead"],
  queryFn: fetchLead,
  staleTime: 60_000,
});

const deskQuery = (desk: string, limit: number) =>
  queryOptions({
    queryKey: ["articles", "desk", desk, limit],
    queryFn: () => fetchDesk(desk, limit),
    staleTime: 60_000,
  });

function bulletsOf(article: Article): string[] {
  // Internal editorial notes are dropped, never rendered.
  return publicBullets(article.summary_bullets).slice(0, 3);
}

function SourceLink({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open the original article in a new tab"
      className="inline-flex shrink-0 items-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <ExternalLink className="h-4 w-4" aria-hidden />
    </a>
  );
}

function MetaRow({ article }: { article: Article }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {article.source_name ? (
        <span className="rounded-full bg-secondary px-2 py-0.5 font-semibold text-secondary-foreground">
          {article.source_name}
        </span>
      ) : null}
      {article.city ? (
        <span className="rounded-full border border-border px-2 py-0.5">{article.city}</span>
      ) : null}
      <RelativeDate iso={article.published_at} />
    </div>
  );
}

function Takeaways({ article }: { article: Article }) {
  const [open, setOpen] = useState(false);
  const bullets = bulletsOf(article);
  if (!bullets.length) return null;
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-primary"
      >
        Key takeaways
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <ul className="mt-2 space-y-1.5 rounded-lg bg-muted/60 p-3 text-sm leading-snug text-foreground">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden className="text-primary">
                •
              </span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function NewsCard({ article, compact = false }: { article: Article; compact?: boolean }) {
  return (
    <article className="border-b border-border py-4 last:border-b-0">
      <div className="flex gap-3">
        <SmartImage
          src={article.image_url || articleFallback}
          fallbackSrc={articleFallback}
          alt=""
          aria-hidden
          loading="lazy"
          optimizedWidth={240}
          className="h-16 w-24 shrink-0 rounded-md object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3
              className={
                compact ? "text-sm font-semibold leading-snug" : "text-base font-bold leading-snug"
              }
            >
              {article.title}
            </h3>
            <SourceLink url={article.source_url} />
          </div>
          <MetaRow article={article} />
          <Takeaways article={article} />
        </div>
      </div>
    </article>
  );
}

function LeadHero({ headingLevel = "h1" }: { headingLevel?: "h1" | "h3" }) {
  const { data = [], isLoading } = useQuery(leadQuery);
  const lead = data[0];
  if (isLoading) return <div className="h-48 animate-pulse rounded-xl bg-muted" />;
  if (!lead) return null;
  const Heading = headingLevel;
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card">
      <SmartImage
        src={lead.image_url || articleFallback}
        fallbackSrc={articleFallback}
        alt={lead.title}
        loading="lazy"
        className="h-52 w-full object-cover sm:h-72"
      />
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <Heading className="text-xl font-extrabold leading-tight sm:text-3xl">
            {lead.title}
          </Heading>
          <SourceLink url={lead.source_url} />
        </div>
        {publicText(lead.summary) ? (
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            {publicText(lead.summary)}
          </p>
        ) : null}
        <MetaRow article={lead} />
        <Takeaways article={lead} />
      </div>
    </article>
  );
}

function DeskList({
  desk,
  limit,
  heading,
  compact = false,
}: {
  desk: string;
  limit: number;
  heading: string;
  compact?: boolean;
}) {
  const { data = [], isLoading } = useQuery(deskQuery(desk, limit));
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{heading}</h2>
      {isLoading ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : data.length ? (
        <div className="mt-1">
          {data.map((a) => (
            <NewsCard key={a.id} article={a} compact={compact} />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Nothing filed yet.</p>
      )}
    </section>
  );
}

/** The two-column digest: lead hero, Bay Area list, and a right-hand rail. */
export function SmartDigest({ embedded = false }: { embedded?: boolean }) {
  return (
    <div>
      <LeadHero headingLevel={embedded ? "h3" : "h1"} />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <DeskList desk="bay-area" limit={15} heading="Bay Area Digest" />
        <div className="space-y-6">
          <DeskList desk="telangana-andhra" limit={10} heading="Telangana & Andhra" compact />
          <DeskList desk="cinema-glamour" limit={6} heading="Glamour & Cinema" compact />
        </div>
      </div>
    </div>
  );
}
