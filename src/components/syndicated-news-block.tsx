import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Newspaper } from "lucide-react";
import type { SyndicatedStory } from "@/lib/syndicated.functions";
import { formatDate } from "@/lib/content";
import { SmartImage } from "@/components/smart-image";

export function SyndicatedNewsBlock({ stories }: { stories: SyndicatedStory[] }) {
  if (!stories.length) return null;
  return (
    <section aria-labelledby="wire-desk-heading" className="mt-8 border-y border-border py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            <Newspaper className="h-4 w-4" aria-hidden /> Wire desk
          </p>
          <h2 id="wire-desk-heading" className="mt-1 text-xl font-bold text-ink sm:text-2xl">
            More Indian-American Headlines
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Diaspora and India coverage from partner newsrooms, credited and linked to the source.
          </p>
        </div>
        <Link to="/category/$category" params={{ category: "city-news" }} className="text-sm font-semibold text-primary">
          All City News
        </Link>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {stories.map((story) => (
          <article key={story.id} className="min-w-0">
            {story.image_url ? (
              <a href={story.canonical_url} target="_blank" rel="nofollow noopener noreferrer" className="group block">
                <SmartImage
                  src={story.image_url}
                  alt={story.title}
                  loading="lazy"
                  decoding="async"
                  optimizedWidth={640}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="aspect-video w-full bg-surface-tint object-cover object-top transition-transform duration-500 group-hover:scale-[1.02]"
                />
              </a>
            ) : null}
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-primary">
              {story.source_category ?? "News"}
            </p>
            <h3 className="mt-1 line-clamp-3 text-base font-bold leading-snug">
              <a href={story.canonical_url} target="_blank" rel="nofollow noopener noreferrer" className="headline-link">
                {story.title} <ArrowUpRight className="inline h-3.5 w-3.5" aria-hidden />
              </a>
            </h3>
            {story.excerpt ? <p className="mt-2 line-clamp-3 text-sm leading-snug text-muted-foreground">{story.excerpt}</p> : null}
            <p className="mt-2 text-[11px] text-muted-foreground">
              Source: {story.source_name}{story.published_at ? ` · ${formatDate(story.published_at)}` : ""}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
