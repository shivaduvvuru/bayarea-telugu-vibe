/**
 * Community directory, read from the site's own store only.
 *
 * Two own sources are merged: directory items curated in the newsroom CMS
 * (`content_items` with kind = 'directory') and owner-verified listing claims
 * that staff have approved.
 */
import type { DirectoryEntry } from "./content";
import { publicClient } from "./cms.server";
import { dedupeBy } from "./dedupe";

/** Stable numeric id derived from a row uuid (DirectoryEntry.id is a number). */
function numericId(uuid: string) {
  let h = 0;
  for (let i = 0; i < uuid.length; i += 1) h = (h * 31 + uuid.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export async function cmsDirectory(): Promise<DirectoryEntry[]> {
  const db = publicClient();

  const [items, claims] = await Promise.all([
    db
      .from("content_items")
      .select("id, title, summary, image_url, category, city")
      .eq("status", "published")
      .eq("kind", "directory")
      .limit(200),
    db
      .from("directory_claims")
      .select("id, listing_id, listing_title, city, address, hours, website, phone")
      .eq("status", "approved")
      .limit(200),
  ]);

  const entries: DirectoryEntry[] = [];

  for (const row of items.data ?? []) {
    entries.push({
      id: numericId(row.id),
      slug: `c-${row.id}`,
      title: row.title,
      excerpt: (row.summary ?? "").slice(0, 200),
      image: row.image_url ?? null,
      category: row.category ?? row.city ?? null,
    });
  }

  for (const claim of claims.data ?? []) {
    entries.push({
      id: claim.listing_id,
      slug: `claim-${claim.id}`,
      title: claim.listing_title,
      excerpt: [claim.address, claim.hours, claim.phone, claim.website]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 200),
      image: null,
      category: claim.city ?? null,
    });
  }

  const { unique, duplicates } = dedupeBy(entries, (e) => `${e.title} ${e.category ?? ""}`);
  const extras = new Map(duplicates.map((d) => [d.kept.id, d.dropped.map((x) => x.slug)]));
  return unique.map((e) => {
    const dupes = extras.get(e.id);
    return dupes ? { ...e, duplicates: dupes } : e;
  });
}
