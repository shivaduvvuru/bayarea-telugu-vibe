import { createServerFn } from "@tanstack/react-start";

/** Public universal directory search — anon-readable published rows only. */
export const searchDirectory = createServerFn({ method: "GET" })
  .inputValidator(
    (data?: {
      q?: string;
      category?: string;
      subcategory?: string;
      city?: string;
      county?: string;
      zip?: string;
      community?: string;
      verified?: boolean;
      featured?: boolean;
      sort?: string;
      limit?: number;
    }) => ({
      q: typeof data?.q === "string" ? data.q.slice(0, 80) : "",
      category: typeof data?.category === "string" ? data.category.slice(0, 40) : "",
      subcategory: typeof data?.subcategory === "string" ? data.subcategory.slice(0, 40) : "",
      city: typeof data?.city === "string" ? data.city.slice(0, 60) : "",
      county: typeof data?.county === "string" ? data.county.slice(0, 60) : "",
      zip: typeof data?.zip === "string" ? data.zip.slice(0, 10) : "",
      community: typeof data?.community === "string" ? data.community.slice(0, 60) : "",
      verified: data?.verified === true,
      featured: data?.featured === true,
      sort: typeof data?.sort === "string" ? data.sort.slice(0, 20) : "relevance",
      limit: Math.min(Math.max(Number(data?.limit ?? 60), 1), 200),
    }),
  )
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const { ENTITY_COLUMNS } = await import("@/lib/directory");
    const db = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"]!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    let query = db
      .from("directory_entities")
      .select(ENTITY_COLUMNS)
      .eq("status", "published")
      .limit(data.limit);

    if (data.category) {
      const path = data.subcategory ? `${data.category}:${data.subcategory}` : null;
      if (path) {
        query = query.or(
          `and(category.eq.${data.category},subcategory.eq.${data.subcategory}),extra_categories.cs.{"${path}"}`,
        );
      } else {
        query = query.or(
          `category.eq.${data.category},extra_categories.cs.{"${data.category}"}`,
        );
      }
    }
    if (data.city) query = query.ilike("city", data.city);
    if (data.county) query = query.eq("county", data.county);
    if (data.zip) query = query.eq("zip", data.zip);
    if (data.community) query = query.contains("community_tags", [data.community]);
    if (data.verified) query = query.eq("verified_status", true);
    if (data.featured) query = query.eq("featured_status", true);
    if (data.q) {
      const term = data.q.replace(/[%,()]/g, " ").trim();
      if (term) query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
    }

    if (data.sort === "newest") query = query.order("created_at", { ascending: false });
    else if (data.sort === "rating") query = query.order("tba_rating", { ascending: false, nullsFirst: false });
    else query = query.order("featured_status", { ascending: false }).order("name");

    const { data: rows, error } = await query;
    if (error) throw error;
    return rows ?? [];
  });

/** Public counts per category, for the browse landing. */
export const directoryCategoryCounts = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await db
    .from("directory_entities")
    .select("category, city")
    .eq("status", "published")
    .limit(40000);
  if (error) throw error;
  const rows = (data ?? []) as { category: string; city: string | null }[];
  const counts = new Map<string, number>();
  const cities = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.category, (counts.get(row.category) ?? 0) + 1);
    if (row.city) cities.set(row.city, (cities.get(row.city) ?? 0) + 1);
  }
  return {
    total: rows.length,
    categories: [...counts.entries()].map(([key, total]) => ({ key, total })),
    cities: [...cities.entries()]
      .map(([city, total]) => ({ city, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 40),
  };
});

/* ------------------------------ desk-gated ------------------------------ */

type IngestInput = {
  counties?: string[];
  cities?: string[];
  categories?: string[];
  subcategories?: string[];
  maxQueries?: number;
  perQuery?: number;
  deskToken?: string;
};

const ingestValidator = (data: IngestInput) => ({
  counties: (Array.isArray(data?.counties) ? data.counties : []).slice(0, 12).map(String),
  cities: (Array.isArray(data?.cities) ? data.cities : []).slice(0, 40).map(String),
  categories: (Array.isArray(data?.categories) ? data.categories : []).slice(0, 20).map(String),
  subcategories: (Array.isArray(data?.subcategories) ? data.subcategories : []).slice(0, 40).map(String),
  maxQueries: typeof data?.maxQueries === "number" ? data.maxQueries : undefined,
  perQuery: typeof data?.perQuery === "number" ? data.perQuery : undefined,
  deskToken: typeof data?.deskToken === "string" ? data.deskToken : undefined,
});

async function runIngest(data: ReturnType<typeof ingestValidator>, preview: boolean) {
  const { assertDesk } = await import("@/lib/desk-session.server");
  await assertDesk(data.deskToken);
  const { admin } = await import("@/lib/cms.server");
  const { ingestDirectoryFromOsm } = await import("@/lib/directory-osm.server");
  return ingestDirectoryFromOsm(await admin(), {
    counties: data.counties.length > 0 ? data.counties : undefined,
    cities: data.cities.length > 0 ? data.cities : undefined,
    categories: data.categories.length > 0 ? data.categories : undefined,
    subcategories: data.subcategories.length > 0 ? data.subcategories : undefined,
    maxQueries: data.maxQueries,
    perQuery: data.perQuery,
    preview,
  });
}

/** Dry run: report what an import would do, without writing. */
export const previewDirectoryIngest = createServerFn({ method: "POST" })
  .inputValidator(ingestValidator)
  .handler(({ data }) => runIngest(data, true));

/** Import from OpenStreetMap into the shared directory. */
export const runDirectoryIngest = createServerFn({ method: "POST" })
  .inputValidator(ingestValidator)
  .handler(({ data }) => runIngest(data, false));

/** Desk snapshot: coverage per category and county, plus provider budgets. */
export const directoryStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { deskToken?: string }) => ({
    deskToken: typeof data?.deskToken === "string" ? data.deskToken : undefined,
  }))
  .handler(async ({ data }) => {
    const { assertDesk } = await import("@/lib/desk-session.server");
    await assertDesk(data.deskToken);
    const { admin } = await import("@/lib/cms.server");
    const { directoryCoverage } = await import("@/lib/directory-osm.server");
    const { listBudgets } = await import("@/lib/api-budget.server");
    const db = await admin();
    const [coverage, budgets] = await Promise.all([directoryCoverage(db), listBudgets(db)]);
    return { ...coverage, budgets };
  });
