import { createFileRoute, Link } from "@tanstack/react-router";

const TITLE = "About Times Bay Area — Indian Community News";
const DESC =
  "Times Bay Area brings local news, culture and community coverage to Indian families across Northern California."

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-ink">మా గురించి</h1>
      <div className="mt-6 space-y-4 text-[17px] leading-relaxed text-foreground">
        <p>
          Times Bay Area is a trusted home for Indian community news across Northern California,
          with a local Bay Area newsroom.
        </p>
        <p>
          We cover the news that matters to Indian families here: local government and schools,
          immigration and careers, temple and association activity, cinema, sport and the
          cultural calendar from San Francisco to San Jose.
        </p>
        <p>
          The newsroom publishes daily online and a weekly digital print edition every Friday.
          Community organisations are welcome to submit event notices and photographs.
        </p>
      </div>
      <p className="mt-10 text-sm text-muted-foreground">
        For news tips, advertising, or event listings, please{" "}
        <Link to="/contact" className="font-semibold text-primary hover:underline">
          contact us
        </Link>
        .
      </p>
    </div>
  );
}