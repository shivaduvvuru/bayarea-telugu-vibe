import { createFileRoute } from "@tanstack/react-router";
import { clearTempleCache, listTempleAnnouncements } from "@/lib/temples.functions";
import { clearPoliticsCache, listPolitics } from "@/lib/politics.functions";
import type { IngestRow } from "@/lib/cms.server";

/**
 * Scheduled content pull (run twice daily by an external scheduler):
 * re-pulls temple announcements and political headlines into the site's own
 * content store so the next visitor gets fresh data with no cold-fetch
 * latency. Articles and the directory live entirely in the own store.
 *
 *   POST /api/public/refresh-content
 *   Authorization: Bearer <CONTENT_REFRESH_SECRET>
 */
async function refresh() {
  const results: Record<string, number> = {};
  const { ingest } = await import("@/lib/cms.server");
  const queued: IngestRow[] = [];

  // Temple announcements are scraped from each temple's own website.
  clearTempleCache();
  try {
    const temples = await listTempleAnnouncements();
    results["temple_announcements"] = temples.reduce(
      (n, t) => n + t.announcements.length,
      0,
    );
    results["temples_with_news"] = temples.filter((t) => t.announcements.length > 0).length;
    for (const feed of temples) {
      for (const a of feed.announcements) {
        queued.push({
          source: `temple:${feed.id}`,
          source_ref: `temple:${feed.id}:${a.url}`,
          kind: "announcement",
          title: `${feed.name}: ${a.title}`,
          link_url: a.url,
          city: feed.city ?? null,
          category: "temples",
        });
      }
    }
  } catch (err) {
    console.error("refresh-content: temples failed", err);
    results["temple_announcements"] = -1;
  }

  // City-hall and Indian political headlines, pulled from publisher feeds.
  clearPoliticsCache();
  try {
    const groups = await listPolitics();
    results["politics_stories"] = groups.reduce((n, g) => n + g.stories.length, 0);
    results["politics_places"] = groups.length;
    for (const group of groups) {
      for (const s of group.stories) {
        queued.push({
          source: `politics:${group.id}`,
          source_ref: `politics:${s.url}`,
          kind: "news",
          title: s.title,
          summary: s.publisher || null,
          link_url: s.url,
          city: group.scope === "local" ? group.place : null,
          category: "political",
          published_at: s.date ?? null,
        });
      }
    }
  } catch (err) {
    console.error("refresh-content: politics failed", err);
    results["politics_stories"] = -1;
  }

  // Record everything we pulled so editors see a title list they can veto.
  try {
    const { inserted, skipped, duplicates } = await ingest(queued);
    results["cms_new_items"] = inserted;
    results["cms_already_known"] = skipped;
    results["cms_duplicates_blocked"] = duplicates;
  } catch (err) {
    console.error("refresh-content: cms ingest failed", err);
    results["cms_new_items"] = -1;
  }

  return { ok: true, refreshedAt: new Date().toISOString(), results };
}


export const Route = createFileRoute("/api/public/refresh-content")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CONTENT_REFRESH_SECRET"];
        if (!secret) {
          return new Response("Refresh secret not configured", { status: 503 });
        }
        const auth = request.headers.get("authorization") ?? "";
        if (auth !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }
        return Response.json(await refresh());
      },
    },
  },
});