import { createFileRoute, Link } from "@tanstack/react-router";
import { CommunityAppeal } from "@/components/ads";

const TITLE = "Bay Area Icons — Bay Area Telugu Times";
const DESC =
  "Telugu community leaders, entrepreneurs, artists and volunteers representing the San Francisco Bay Area today.";

export const Route = createFileRoute("/bay-area-icons")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BayAreaIconsPage,
});

/** Profiles are added as the editorial team supplies content. */
const ICONS: { name: string; role: string; bio: string }[] = [];

function BayAreaIconsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Community People</p>
      <h1 className="mt-2 text-3xl font-bold text-ink md:text-4xl">Bay Area Icons</h1>

      <div className="mt-6 space-y-4 text-[17px] leading-relaxed text-foreground">
        <p>
          While the Foundation Icons built the base, the Bay Area Telugu community today is
          carried forward by leaders in technology, business, medicine, law, arts, education and
          social service. Telugu Times identifies and places these individuals as{" "}
          <strong>Bay Area Icons</strong>, and keeps adding to the list as we reach them or they
          reach us.
        </p>
      </div>

      <h2 className="mt-10 border-b-2 border-primary pb-2 text-xl font-bold text-ink">
        The Icons
      </h2>
      {ICONS.length === 0 ? (
        <p className="mt-5 text-base text-muted-foreground">
          Profiles are being compiled. Each icon will appear here with a photograph and a short
          description in two columns.
        </p>
      ) : (
        <ul className="mt-5 space-y-6">
          {ICONS.map((p, i) => (
            <li key={p.name} className="grid gap-4 border-b border-border pb-6 sm:grid-cols-[1fr_2fr]">
              <div className="flex aspect-[3/4] items-center justify-center bg-surface-tint text-sm text-muted-foreground">
                Photo
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{i + 1}</p>
                <h3 className="text-lg font-bold text-ink">{p.name}</h3>
                <p className="text-sm font-medium text-primary">{p.role}</p>
                <p className="mt-2 text-sm leading-relaxed text-foreground">{p.bio}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CommunityAppeal what="individuals" />

      <Link
        to="/foundation-icons"
        className="mt-6 inline-block text-sm font-semibold text-primary hover:underline"
      >
        See Bay Area Foundation Icons
      </Link>
    </div>
  );
}