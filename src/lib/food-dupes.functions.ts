import { createServerFn } from "@tanstack/react-start";

/** Duplicate groups detected in the restaurant directory. Editorial desk only. */
export const listRestaurantDuplicates = createServerFn({ method: "POST" })
  .inputValidator((data: { deskToken?: string }) => ({
    deskToken: typeof data?.deskToken === "string" ? data.deskToken : undefined,
  }))
  .handler(async ({ data }) => {
    const { assertDesk } = await import("@/lib/desk-session.server");
    await assertDesk(data.deskToken);
    const { admin } = await import("@/lib/cms.server");
    const { findDuplicateGroups } = await import("@/lib/food-dupes.server");
    return { groups: await findDuplicateGroups(await admin()) };
  });

/** Merges duplicate listings into one. Editorial desk only. */
export const mergeRestaurantDuplicates = createServerFn({ method: "POST" })
  .inputValidator((data: { primaryId: string; duplicateIds: string[]; deskToken?: string }) => {
    if (!data?.primaryId) throw new Error("Pick the listing to keep.");
    return {
      primaryId: String(data.primaryId),
      duplicateIds: (Array.isArray(data.duplicateIds) ? data.duplicateIds : []).slice(0, 25).map(String),
      deskToken: typeof data.deskToken === "string" ? data.deskToken : undefined,
    };
  })
  .handler(async ({ data }) => {
    const { assertDesk } = await import("@/lib/desk-session.server");
    await assertDesk(data.deskToken);
    const { admin } = await import("@/lib/cms.server");
    const { mergeRestaurants } = await import("@/lib/food-dupes.server");
    return mergeRestaurants(await admin(), data.primaryId, data.duplicateIds);
  });
