import { createServerFn } from "@tanstack/react-start";

/** Desk-gated preview of an OpenStreetMap pull — no writes, report only. */
export const previewOsmRestaurants = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { cities?: string[]; cuisine?: string; perCity?: number; deskToken?: string }) => ({
      cities: (Array.isArray(data?.cities) ? data.cities : []).slice(0, 40).map(String),
      cuisine: typeof data?.cuisine === "string" ? data.cuisine.slice(0, 40) : undefined,
      perCity: typeof data?.perCity === "number" ? data.perCity : undefined,
      deskToken: typeof data?.deskToken === "string" ? data.deskToken : undefined,
    }),
  )
  .handler(async ({ data }) => {
    const { assertDesk } = await import("@/lib/desk-session.server");
    await assertDesk(data.deskToken);
    const { admin } = await import("@/lib/cms.server");
    const { ingestOsmCities } = await import("@/lib/osm.server");
    return ingestOsmCities(await admin(), {
      cities: data.cities.length > 0 ? data.cities : undefined,
      cuisine: data.cuisine,
      perCity: data.perCity,
      preview: true,
    });
  });

/** Desk-gated OpenStreetMap import for the restaurant directory. */
export const ingestOsmRestaurants = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { cities?: string[]; cuisine?: string; perCity?: number; deskToken?: string }) => ({
      cities: (Array.isArray(data?.cities) ? data.cities : []).slice(0, 40).map(String),
      cuisine: typeof data?.cuisine === "string" ? data.cuisine.slice(0, 40) : undefined,
      perCity: typeof data?.perCity === "number" ? data.perCity : undefined,
      deskToken: typeof data?.deskToken === "string" ? data.deskToken : undefined,
    }),
  )
  .handler(async ({ data }) => {
    const { assertDesk } = await import("@/lib/desk-session.server");
    await assertDesk(data.deskToken);
    const { admin } = await import("@/lib/cms.server");
    const { ingestOsmCities } = await import("@/lib/osm.server");
    return ingestOsmCities(await admin(), {
      cities: data.cities.length > 0 ? data.cities : undefined,
      cuisine: data.cuisine,
      perCity: data.perCity,
      preview: false,
    });
  });

/** Directory coverage per city plus provider availability and cost budgets. */
export const foodSourceStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { deskToken?: string }) => ({
    deskToken: typeof data?.deskToken === "string" ? data.deskToken : undefined,
  }))
  .handler(async ({ data }) => {
    const { assertDesk } = await import("@/lib/desk-session.server");
    await assertDesk(data.deskToken);
    const { admin } = await import("@/lib/cms.server");
    const { FOOD_CITIES, CITY_COORDS } = await import("@/lib/food");
    const { listBudgets } = await import("@/lib/api-budget.server");
    const { foursquareConfigured } = await import("@/lib/foursquare.server");
    const db = await admin();

    const { data: rows, error } = await db
      .from("restaurants")
      .select("city, source")
      .eq("status", "published")
      .limit(20000);
    if (error) throw error;

    const counts = new Map<string, { total: number; osm: number }>();
    for (const r of (rows ?? []) as { city: string | null; source: string | null }[]) {
      const key = r.city ?? "Unknown";
      const c = counts.get(key) ?? { total: 0, osm: 0 };
      c.total += 1;
      if (r.source === "osm") c.osm += 1;
      counts.set(key, c);
    }

    return {
      total: (rows ?? []).length,
      cities: FOOD_CITIES.map((city) => ({
        city,
        total: counts.get(city)?.total ?? 0,
        osm: counts.get(city)?.osm ?? 0,
        mappable: !!CITY_COORDS[city],
      })),
      budgets: await listBudgets(db),
      providers: {
        osm: true,
        foursquare: foursquareConfigured(),
        yelp: (process.env["YELP_API_KEY"] ?? "").trim().length > 20,
      },
    };
  });

/** Raises/lowers a provider's monthly cost limit or switches it off. */
export const setApiBudget = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { provider?: string; enabled?: boolean; monthlyLimitUsd?: number; deskToken?: string }) => ({
      provider: String(data?.provider ?? ""),
      enabled: typeof data?.enabled === "boolean" ? data.enabled : undefined,
      monthlyLimitUsd:
        typeof data?.monthlyLimitUsd === "number" ? data.monthlyLimitUsd : undefined,
      deskToken: typeof data?.deskToken === "string" ? data.deskToken : undefined,
    }),
  )
  .handler(async ({ data }) => {
    const { assertDesk } = await import("@/lib/desk-session.server");
    await assertDesk(data.deskToken);
    const { admin } = await import("@/lib/cms.server");
    const { updateBudget } = await import("@/lib/api-budget.server");
    return updateBudget(await admin(), data.provider, {
      ...(typeof data.enabled === "boolean" ? { enabled: data.enabled } : {}),
      ...(typeof data.monthlyLimitUsd === "number"
        ? { monthly_limit_usd: data.monthlyLimitUsd }
        : {}),
    });
  });

/** Optional, budget-capped Foursquare enrichment for one listing. */
export const enrichRestaurant = createServerFn({ method: "POST" })
  .inputValidator((data: { slug?: string; force?: boolean; deskToken?: string }) => ({
    slug: String(data?.slug ?? "").slice(0, 120),
    force: data?.force === true,
    deskToken: typeof data?.deskToken === "string" ? data.deskToken : undefined,
  }))
  .handler(async ({ data }) => {
    const { assertDesk } = await import("@/lib/desk-session.server");
    await assertDesk(data.deskToken);
    const { admin } = await import("@/lib/cms.server");
    const { enrichRestaurantFromFoursquare } = await import("@/lib/foursquare.server");
    return enrichRestaurantFromFoursquare(await admin(), data.slug, { force: data.force });
  });
