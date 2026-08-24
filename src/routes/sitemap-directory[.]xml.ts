import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { SITE_ORIGIN, BASE_PATH } from "@/lib/site";

const BASE_URL = SITE_ORIGIN + BASE_PATH;
/** Well under the 50,000-URL limit, so a page never has to be split later. */
export const DIRECTORY_PAGE_SIZE = 45000;

/** Every published directory listing, paginated with ?page=N (1-based). */
export const Route = createFileRoute("/sitemap-directory.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const page = Math.max(
          1,
          Number(new URL(request.url).searchParams.get("page") ?? "1") || 1,
        );
        const from = (page - 1) * DIRECTORY_PAGE_SIZE;

        let rows: { slug: string; last_synced_at: string | null; created_at: string }[] = [];
        try {
          const { publicClient } = await import("@/lib/cms.server");
          const db = publicClient();
          const { data, error } = await db
            .from("directory_entities")
            .select("slug, last_synced_at, created_at")
            .eq("status", "published")
            .order("created_at", { ascending: true })
            .range(from, from + DIRECTORY_PAGE_SIZE - 1);
          if (error) throw error;
          rows = (data ?? []) as typeof rows;
        } catch (err) {
          console.error("directory sitemap failed", err);
        }

        const urls = rows
          .filter((r) => r.slug)
          .map((r) => {
            const lastmod = (r.last_synced_at ?? r.created_at ?? "").slice(0, 10);
            return [
              `  <url>`,
              `    <loc>${BASE_URL}/directory/${encodeURIComponent(r.slug)}</loc>`,
              lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
              `    <changefreq>monthly</changefreq>`,
              `    <priority>0.5</priority>`,
              `  </url>`,
            ]
              .filter(Boolean)
              .join("\n");
          });

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            // Listings change slowly; a longer cache keeps Overpass-fed rows cheap to serve.
            "Cache-Control": "public, max-age=21600, stale-while-revalidate=86400",
          },
        });
      },
    },
  },
});
