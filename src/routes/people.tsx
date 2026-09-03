import { createFileRoute, Link } from "@tanstack/react-router";
import { CommunityAppeal } from "@/components/ads";

const TITLE = "Bay Area Telugu People — Foundation Icons & Bay Area Icons | Times Bay Area";
const DESC =
  "Community leaders, pioneers and achievers: Bay Area Foundation Icons and Bay Area Icons recognised by Times Bay Area.";

export const Route = createFileRoute("/people")({
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
  component: PeoplePage,
});

function PeoplePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Community</p>
      <h1 className="mt-2 text-3xl font-bold text-ink md:text-4xl">People</h1>
      <p className="mt-3 text-[17px] leading-relaxed text-foreground">
        Times Bay Area recognises the people who built and who represent the Bay Area Telugu
        community in two ways — the pioneers who came first, and the achievers of today.
      </p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <Link
          to="/foundation-icons"
          className="rounded-sm border border-border bg-surface-tint p-6 transition-colors hover:border-primary"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Slide 1</p>
          <h2 className="mt-2 text-xl font-bold text-ink">Bay Area Foundation Icons</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Telugus who reached the Bay Area in the 70s, 80s and 90s and laid the foundation for
            the community that thrives today.
          </p>
          <span className="mt-4 inline-block text-sm font-semibold text-primary">
            View Foundation Icons
          </span>
        </Link>
        <Link
          to="/bay-area-icons"
          className="rounded-sm border border-border bg-surface-tint p-6 transition-colors hover:border-primary"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Slide 2</p>
          <h2 className="mt-2 text-xl font-bold text-ink">Bay Area Icons</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Community leaders, entrepreneurs, artists, doctors and volunteers who represent the
            Telugu community across the Bay Area today.
          </p>
          <span className="mt-4 inline-block text-sm font-semibold text-primary">
            View Bay Area Icons
          </span>
        </Link>
      </div>

      <CommunityAppeal what="individuals" />
    </div>
  );
}