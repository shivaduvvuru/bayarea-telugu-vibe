import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { SITE_ORIGIN, BASE_PATH } from "@/lib/site";

const BASE_URL = SITE_ORIGIN + BASE_PATH;

function esc(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Published stories from the last 30 days, with Google News tags. */
export const Route = createFileRoute("/sitemap-news.xml")({
  server: {
    handlers: {
      GET: async () => {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        let rows: {
          id: string;
          title: string;
          published_at: string | null;
          created_at: string;
        }[] = [];
        try {
          const { publicClient } = await import("@/lib/cms.server");
          const db = publicClient();
          const { data, error } = await db
            .from("content_items")
            .select("id, title, published_at, created_at")
            .eq("status", "published")
            .neq("placement", "hidden")
            .gte("published_at", since)
            .order("published_at", { ascending: false })
            .limit(45000);
          if (error) throw error;
          rows = (data ?? []) as typeof rows;
        } catch (err) {
          console.error("news sitemap failed", err);
        }

        const urls = rows.map((r) => {
          const date = r.published_at ?? r.created_at;
          return [
            `  <url>`,
            `    <loc>${BASE_URL}/article/c-${r.id}</loc>`,
            `    <lastmod>${date}</lastmod>`,
            `    <news:news>`,
            `      <news:publication>`,
            `        <news:name>Times Bay Area</news:name>`,
            `        <news:language>en</news:language>`,
            `      </news:publication>`,
            `      <news:publication_date>${date}</news:publication_date>`,
            `      <news:title>${esc(r.title ?? "")}</news:title>`,
            `    </news:news>`,
            `  </url>`,
          ].join("\n");
        });

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">`,
          ...urls,
          `</urlset>`,
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
