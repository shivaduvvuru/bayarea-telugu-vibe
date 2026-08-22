import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RestaurantQuery, ClaimInput } from "@/lib/food.server";

export const fetchRestaurants = createServerFn({ method: "GET" })
  .inputValidator((data: RestaurantQuery) => data ?? {})
  .handler(async ({ data }) => {
    const { readRestaurants } = await import("@/lib/food.server");
    return readRestaurants(data);
  });

export const fetchRestaurant = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const { readRestaurant } = await import("@/lib/food.server");
    return readRestaurant(data.slug);
  });

export const fetchFoodDeals = createServerFn({ method: "GET" })
  .inputValidator((data: { city?: string; cuisine?: string } | undefined) => data ?? {})
  .handler(async ({ data }) => {
    const { readDeals } = await import("@/lib/food.server");
    return readDeals(data);
  });

export const fetchFoodCollections = createServerFn({ method: "GET" }).handler(async () => {
  const { readCollections } = await import("@/lib/food.server");
  return readCollections();
});

export const fetchFoodCollection = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const { readCollection } = await import("@/lib/food.server");
    return readCollection(data.slug);
  });

export const submitRestaurantClaim = createServerFn({ method: "POST" })
  .inputValidator((data: ClaimInput) => data)
  .handler(async ({ data }) => {
    const { validateClaim, saveClaim } = await import("@/lib/food-write.server");
    return saveClaim(validateClaim(data));
  });

export const saveRestaurantReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      restaurant_id: string;
      rating: number;
      body?: string;
      dishes?: string[];
      photos?: string[];
      veg_favorite?: boolean;
      family_friendly?: boolean;
      recommends?: boolean;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { upsertReview } = await import("@/lib/food-write.server");
    return upsertReview(context.supabase, context.userId, context.claims, data);
  });

export const fetchMyReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { restaurant_id: string }) => data)
  .handler(async ({ data, context }) => {
    const { readMyReview } = await import("@/lib/food-write.server");
    return readMyReview(context.supabase, context.userId, data.restaurant_id);
  });
