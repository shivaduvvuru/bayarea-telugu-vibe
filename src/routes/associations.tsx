import { createFileRoute } from "@tanstack/react-router";

const TITLE = "Associations — Times Bay Area";
const DESC = "Association listings are currently unavailable.";

export const Route = createFileRoute("/associations")({
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
  component: AssociationsPage,
});

function AssociationsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Community</p>
      <h1 className="mt-2 text-3xl font-bold text-ink md:text-4xl">Associations</h1>
      <p className="mt-3 text-[17px] leading-relaxed text-muted-foreground">
        Association listings are currently unavailable.
      </p>
    </div>
  );
}