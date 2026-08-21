import type { Article, DirectoryEntry } from "./content";
import sanitize from "sanitize-html";

export type Embedded = {
  "wp:featuredmedia"?: Array<{ source_url?: string }>;
  "wp:term"?: Array<Array<{ taxonomy: string; slug: string; name: string }>>;
  author?: Array<{ name?: string }>;
};

export type WpPost = {
  id: number;
  slug: string;
  date: string;
  title: { rendered: string };
  excerpt?: { rendered: string };
  content?: { rendered: string };
  _embedded?: Embedded;
};

export function decode(html: string) {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&#8217;|&#039;|&#39;/g, "\u2019")
    .replace(/&#8216;/g, "\u2018")
    .replace(/&#8220;/g, "\u201c")
    .replace(/&#8221;/g, "\u201d")
    .replace(/&#8211;/g, "\u2013")
    .replace(/&#8230;/g, "\u2026")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

/**
 * Server-side allowlist sanitizer for editor-supplied HTML, backed by a real HTML
 * parser (sanitize-html) rather than regex filtering. Only a small set of
 * formatting tags/attributes survive, and URLs must be http(s)/mailto/tel.
 */
export function sanitizeHtml(html: string) {
  return sanitize(html, {
    allowedTags: [
      "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "blockquote", "code", "pre",
      "ul", "ol", "li", "h2", "h3", "h4", "h5", "h6", "span", "div", "a", "img",
      "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      "*": ["lang", "dir"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    transformTags: {
      a: sanitize.simpleTransform("a", { rel: "noopener noreferrer nofollow" }),
    },
  });
}

function safeUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  return /^https:\/\//i.test(url) ? url : null;
}

export function toArticle(p: WpPost): Article {
  const e = p._embedded ?? {};
  const terms = (e["wp:term"] ?? []).flat().filter((t) => t.taxonomy === "category");
  const primary = terms[0];
  return {
    id: p.id,
    slug: p.slug,
    title: decode(p.title.rendered),
    excerpt: decode(p.excerpt?.rendered ?? "").slice(0, 240),
    html: sanitizeHtml(p.content?.rendered ?? ""),
    date: p.date,
    author: e.author?.[0]?.name ?? "Times Bay Area",
    image: safeUrl(e["wp:featuredmedia"]?.[0]?.source_url),
    category: primary?.slug ?? "city-news",
    categoryName: primary ? decode(primary.name) : "News",
  };
}

export function toDirectoryEntry(p: WpPost): DirectoryEntry {
  return {
    id: p.id,
    slug: p.slug,
    title: decode(p.title.rendered),
    excerpt: decode(p.excerpt?.rendered ?? "").slice(0, 200),
    image: safeUrl(p._embedded?.["wp:featuredmedia"]?.[0]?.source_url),
    category:
      (p._embedded?.["wp:term"] ?? [])
        .flat()
        .find((t) => t.taxonomy === "directory_category")?.name ?? null,
  };
}