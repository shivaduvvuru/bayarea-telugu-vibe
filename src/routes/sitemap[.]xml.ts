import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { ALL_CATEGORIES } from "@/lib/wp";
import { TEMPLES, CITY_SLUGS, REGION_SLUGS } from "@/lib/temple-directory";
import { SITE_ORIGIN, BASE_PATH } from "@/lib/site";

const BASE_URL = SITE_ORIGIN + BASE_PATH;

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "daily", priority: "1.0" },
          { path: "/events", changefreq: "weekly", priority: "0.8" },
          { path: "/directory", changefreq: "weekly", priority: "0.7" },
          { path: "/temples", changefreq: "weekly", priority: "0.8" },
          ...REGION_SLUGS.map((r) => ({
            path: `/temples/${r.slug}`,
            changefreq: "weekly" as const,
            priority: "0.6",
          })),
          ...CITY_SLUGS.map((c) => ({
            path: `/temples/${c.slug}`,
            changefreq: "weekly" as const,
            priority: "0.6",
          })),
          ...TEMPLES.map((t) => ({
            path: `/temples/temple/${t.slug}`,
            changefreq: "monthly" as const,
            priority: "0.5",
          })),
          { path: "/politics", changefreq: "daily", priority: "0.7" },
          { path: "/forums", changefreq: "daily", priority: "0.7" },
          { path: "/associations", changefreq: "weekly", priority: "0.6" },
          { path: "/people", changefreq: "weekly", priority: "0.6" },
          { path: "/bay-area-icons", changefreq: "monthly", priority: "0.6" },
          { path: "/explore", changefreq: "weekly", priority: "0.5" },
          { path: "/connect", changefreq: "weekly", priority: "0.5" },
          { path: "/submit", changefreq: "monthly", priority: "0.4" },
          { path: "/epaper", changefreq: "weekly", priority: "0.6" },
          { path: "/foundation-icons", changefreq: "monthly", priority: "0.6" },
          { path: "/about", changefreq: "yearly", priority: "0.4" },
          { path: "/contact", changefreq: "yearly", priority: "0.4" },
          ...ALL_CATEGORIES.map((c) => ({
            path: `/category/${c.slug}`,
            changefreq: "daily" as const,
            priority: "0.7",
          })),
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
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