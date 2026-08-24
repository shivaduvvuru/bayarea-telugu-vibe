import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { SITE_ORIGIN, BASE_PATH } from "@/lib/site";
import { DIRECTORY_PAGE_SIZE } from "./sitemap-directory[.]xml";

const BASE_URL = SITE_ORIGIN + BASE_PATH;

/**
 * Sitemap index. Child sitemaps: static pages, directory listings (paginated),
 * and the last 30 days of news. Volume can grow past 50,000 URLs, so the index
 * shape stays even when a child needs more pages.
 */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const now = new Date().toISOString();
        const children = [`${BASE_URL}/sitemap-pages.xml`];

        let directoryCount = 0;
        try {
          const { publicClient } = await import("@/lib/cms.server");
          const db = publicClient();
          const { count } = await db
            .from("directory_entities")
            .select("id", { count: "exact", head: true })
            .eq("status", "published");
          directoryCount = count ?? 0;
        } catch (err) {
          console.error("sitemap index directory count failed", err);
        }

        const pages = Math.max(1, Math.ceil(directoryCount / DIRECTORY_PAGE_SIZE));
        for (let p = 1; p <= pages; p += 1) {
          children.push(
            p === 1
              ? `${BASE_URL}/sitemap-directory.xml`
              : `${BASE_URL}/sitemap-directory.xml?page=${p}`,
          );
        }
        children.push(`${BASE_URL}/sitemap-news.xml`);

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...children.map((loc) =>
            [
              `  <sitemap>`,
              `    <loc>${loc.replace(/&/g, "&amp;")}</loc>`,
              `    <lastmod>${now}</lastmod>`,
              `  </sitemap>`,
            ].join("\n"),
          ),
          `</sitemapindex>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
