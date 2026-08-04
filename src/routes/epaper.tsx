import { createFileRoute } from "@tanstack/react-router";
import { Newspaper, Download } from "lucide-react";

const TITLE = "E-Paper — Bay Area Telugu Times";
const DESC =
  "Read the weekly digital edition of the Bay Area Telugu Times newspaper.";

const ISSUES = [
  { label: "Aug 1, 2026", note: "Ugadi special edition · 24 pages" },
  { label: "Jul 25, 2026", note: "Community & business · 20 pages" },
  { label: "Jul 18, 2026", note: "Cinema special · 20 pages" },
  { label: "Jul 11, 2026", note: "Education & careers · 16 pages" },
];

export const Route = createFileRoute("/epaper")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: EPaperPage,
});

function EPaperPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold text-ink">ఈ-పేపర్</h1>
      <p className="mt-2 text-muted-foreground">
        The weekly print edition, published every Friday.
      </p>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {ISSUES.map((i) => (
          <div key={i.label} className="border border-border">
            <div className="flex aspect-[3/4] items-center justify-center bg-surface-tint">
              <Newspaper className="h-14 w-14 text-primary/40" />
            </div>
            <div className="p-4">
              <h2 className="text-base font-bold text-ink">{i.label}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{i.note}</p>
              <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-sm bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-dark">
                <Download className="h-4 w-4" />
                Read issue
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}