import { createFileRoute } from "@tanstack/react-router";
import { SmartDigest } from "@/components/smart-digest";

export const Route = createFileRoute("/digest")({
  head: () => ({
    meta: [
      { title: "Daily Smart Digest — Bay Area Telugu Times" },
      {
        name: "description",
        content:
          "A fast, clean digest of Bay Area, Telangana & Andhra, and cinema headlines with three-bullet takeaways and links to the original reporting.",
      },
      { property: "og:title", content: "Daily Smart Digest — Bay Area Telugu Times" },
      {
        property: "og:description",
        content:
          "Bay Area, Telangana & Andhra and cinema headlines with three-bullet takeaways, updated through the day.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
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
