import { createFileRoute } from "@tanstack/react-router";
import { SmartDigest } from "@/components/smart-digest";
import { canonical } from "@/lib/site";

const TITLE = "Daily Smart Digest — Times Bay Area";
const DESCRIPTION =
  "A fast, clean digest of Bay Area, Telangana & Andhra, and cinema headlines with three-bullet takeaways and links to the original reporting.";
const URL = canonical("/digest");

export const Route = createFileRoute("/digest")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: DigestPage,
});

function DigestPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-3 py-5 sm:px-4 sm:py-8">
      <SmartDigest />
    </main>
  );
}
