import { createServerFn } from "@tanstack/react-start";

/** Pulls Yelp restaurant listings and ratings for the chosen cities. Desk only. */
export const ingestYelpRestaurants = createServerFn({ method: "POST" })
  .inputValidator((data: { cities?: string[]; perCity?: number; deskToken?: string }) => ({
    cities: (Array.isArray(data?.cities) ? data.cities : []).slice(0, 40).map(String),
    perCity: typeof data?.perCity === "number" ? data.perCity : undefined,
    deskToken: typeof data?.deskToken === "string" ? data.deskToken : undefined,
  }))
  .handler(async ({ data }) => {
    const { assertDesk } = await import("@/lib/desk-session.server");
    await assertDesk(data.deskToken);
    const { admin } = await import("@/lib/cms.server");
    const { ingestYelpCities } = await import("@/lib/yelp.server");
    return ingestYelpCities(await admin(), {
      cities: data.cities.length > 0 ? data.cities : undefined,
      perCity: data.perCity,
    });
  });

/** Directory coverage per city, so the desk can see where Yelp data is thin. */
export const restaurantCoverage = createServerFn({ method: "POST" })
  .inputValidator((data: { deskToken?: string }) => ({
    deskToken: typeof data?.deskToken === "string" ? data.deskToken : undefined,
  }))
  .handler(async ({ data }) => {
    const { assertDesk } = await import("@/lib/desk-session.server");
    await assertDesk(data.deskToken);
    const { admin } = await import("@/lib/cms.server");
    const { FOOD_CITIES } = await import("@/lib/food");
    const db = await admin();
    const { data: rows, error } = await db
      .from("restaurants")
      .select("city, source")
      .eq("status", "published")
      .limit(5000);
    if (error) throw error;
    const counts = new Map<string, { total: number; yelp: number }>();
    for (const r of (rows ?? []) as { city: string | null; source: string | null }[]) {
      const key = r.city ?? "Unknown";
      const c = counts.get(key) ?? { total: 0, yelp: 0 };
      c.total += 1;
      if (r.source === "yelp") c.yelp += 1;
      counts.set(key, c);
    }
    return {
      cities: FOOD_CITIES.map((city) => ({
        city,
        total: counts.get(city)?.total ?? 0,
        yelp: counts.get(city)?.yelp ?? 0,
      })),
      total: (rows ?? []).length,
    };
  });
