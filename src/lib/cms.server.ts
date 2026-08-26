import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { PUBLIC_COLUMNS, type ContentItem } from "@/lib/cms";
import { canonicalUrl, dedupeBy, dedupeKey, strictTitleKey } from "@/lib/dedupe";
import { classifyForPublish } from "@/lib/classify-at-publish.server";

/** Anonymous, RLS-respecting client for reading published items during SSR. */
export function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Throws unless the signed-in caller is an admin or editor. */
export async function assertStaff(
  supabase: unknown,
  userId: string,
) {
  const client = supabase as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (c: string, v: string) => { limit: (n: number) => Promise<{ data: unknown[] | null }> };
      };
    };
  };
  const { data } = await client.from("user_roles").select("role").eq("user_id", userId).limit(10);
  const rows = (data ?? []) as Array<{ role?: string }>;
  const staff = rows.some((r) => r.role === "admin" || r.role === "editor");
  if (!staff) throw new Error("Forbidden: staff access required");
}

export type IngestRow = {
  source: string;
  source_ref: string;
  kind: string;
  title: string;
  summary?: string | null;
  link_url?: string | null;
  image_url?: string | null;
  city?: string | null;
  region?: string | null;
  category?: string | null;
  published_at?: string | null;
};

function canonicalStoryKey(row: { title?: string | null; link_url?: string | null; source_ref?: string | null }) {
  const url = canonicalUrl(row.link_url ?? row.source_ref);
  const title = strictTitleKey(row.title);
  return url ? `u:${url}${title ? `|${title}` : ""}` : title ? `t:${title}` : "";
}

/**
 * Records automatically pulled items. New rows go live immediately
 * (auto-publish); rows an editor already removed stay removed, because we
 * only insert rows whose source_ref is not already known.
 *
 * Anything that repeats a title already on the site — or repeats within the
 * same pull — is stored with status "duplicate" and linked to the original, so
 * it never reaches readers but still shows up as an alert in the newsroom.
 */
export async function ingest(rows: IngestRow[]) {
  if (rows.length === 0) return { inserted: 0, skipped: 0, duplicates: 0 };
  const db = await admin();
  const refs = rows.map((r) => r.source_ref);
  const known = new Set<string>();
  for (let i = 0; i < refs.length; i += 200) {
    const { data } = await db
      .from("content_items")
      .select("source_ref")
      .in("source_ref", refs.slice(i, i + 200));
    for (const r of data ?? []) if (r.source_ref) known.add(r.source_ref);
  }
  const candidates = rows.filter((r) => !known.has(r.source_ref));
  if (candidates.length === 0) return { inserted: 0, skipped: rows.length, duplicates: 0 };

  // Collapse repeats inside this batch first.
  const { unique: fresh, duplicates: inBatch } = dedupeBy(candidates, canonicalStoryKey);

  // Then check surviving canonical URL + strict-title keys against what the site already carries.
  const titleKeys = fresh.map((r) => strictTitleKey(r.title)).filter((key): key is string => !!key);
  const existing = new Map<string, string>();
  for (let i = 0; i < titleKeys.length; i += 200) {
    const { data } = await db
      .from("content_items")
      .select("id, title, link_url, source_ref, norm_title, canonical_url")
      .neq("status", "duplicate")
      .in("norm_title", titleKeys.slice(i, i + 200));
    for (const r of data ?? []) {
      const key = canonicalStoryKey({
        title: r.title ?? r.norm_title,
        link_url: r.link_url ?? r.canonical_url ?? r.source_ref,
      });
      if (key) existing.set(key, r.id);
    }
  }

  // Server-side duplicate guard: title / URL / body-similarity check against
  // everything already stored. Runs for every entry point that reaches ingest
  // (feed collection, desk backlog flush, WordPress sync). No review step: a
  // match is stored as "duplicate" (never shown) and logged with its original.
  const { guardArticle } = await import("./duplicate-guard.server");
  const guardHits = new Map<string, { id: string; score: number; reason: string }>();
  for (const r of fresh) {
    const guard = await guardArticle(db as never, {
      title: r.title,
      link_url: r.link_url ?? null,
      body: (r as { body?: string | null }).body ?? r.summary ?? null,
      image_url: r.image_url ?? null,
      dedupe_key: dedupeKey(r.title) || null,
      source: r.source,
      entry_point: "ingest",
    });
    if (guard.duplicate) {
      console.log(
        `[dedupe] rejected ${guard.hit.reason} score=${guard.hit.score} original=${guard.hit.id} ` +
          `source="${r.source}" title="${r.title}" url=${r.link_url ?? r.source_ref}`,
      );
      guardHits.set(r.source_ref, guard.hit);
    }
  }

  const now = new Date().toISOString();
  const payload = [
    ...fresh.map((r) => {
      const key = dedupeKey(r.title);
      const hit = guardHits.get(r.source_ref);
      const clash = hit?.id ?? (key ? existing.get(key) : undefined);
      return {
        ...r,
        ...classifyForPublish(r as never),
        dedupe_key: key || null,
        status: clash ? "duplicate" : "published",
        duplicate_of: clash ?? null,
        placement: clash ? "hidden" : "auto",
        published_at: r.published_at ?? now,
      };
    }),

    // Repeats found inside this same pull are recorded too, so editors can see
    // which source keeps re-sending the same item.
    ...inBatch.flatMap((group) =>
      group.dropped.map((r) => ({
        ...r,
        ...classifyForPublish(r as never),
        dedupe_key: group.key,
        status: "duplicate",
        duplicate_of: null,
        placement: "hidden",
        published_at: r.published_at ?? now,
      })),
    ),
  ];

  const { error } = await db.from("content_items").insert(payload);
  if (error) throw error;
  const duplicates = payload.filter((p) => p.status === "duplicate").length;
  return {
    inserted: payload.length - duplicates,
    skipped: rows.length - candidates.length,
    duplicates,
  };
}

/** Published items for the public site, newest first. */
export async function readPublished(opts: { kind?: string | undefined; limit?: number | undefined }) {
  let q = publicClient()
    .from("content_items")
    .select(PUBLIC_COLUMNS)
    .eq("status", "published")
    .neq("placement", "hidden")
    .order("published_at", { ascending: false })
    .limit(opts.limit ?? 12);
  if (opts.kind) q = q.eq("kind", opts.kind);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as ContentItem[];
}