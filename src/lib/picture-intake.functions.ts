import { createServerFn } from "@tanstack/react-start";

export const listPictureBucket = createServerFn({ method: "POST" })
  .inputValidator((data: { bucket?: string; page?: number; pageSize?: number; deskToken?: string }) => ({
    bucket: ["usable", "pending", "approved", "rejected", "safety_blocked", "discovered"].includes(String(data?.bucket))
      ? String(data.bucket)
      : "pending",
    page: Math.max(1, Number(data?.page) || 1),
    pageSize: [24, 48].includes(Number(data?.pageSize)) ? Number(data.pageSize) : 24,
    deskToken: typeof data?.deskToken === "string" ? data.deskToken : undefined,
  }))
  .handler(async ({ data }) => {
    const { assertDesk } = await import("@/lib/desk-session.server");
    await assertDesk(data.deskToken);
    const { admin } = await import("@/lib/cms.server");
    const { listPictureIntake } = await import("@/lib/picture-intake.server");
    return listPictureIntake(await admin(), data as Parameters<typeof listPictureIntake>[1]);
  });

export const getPictureBucketCounts = createServerFn({ method: "POST" })
  .inputValidator((data: { deskToken?: string }) => ({
    deskToken: typeof data?.deskToken === "string" ? data.deskToken : undefined,
  }))
  .handler(async ({ data }) => {
    const { assertDesk } = await import("@/lib/desk-session.server");
    await assertDesk(data.deskToken);
    const { admin } = await import("@/lib/cms.server");
    const { pictureIntakeCounts } = await import("@/lib/picture-intake.server");
    return pictureIntakeCounts(await admin());
  });

export const setPictureBucket = createServerFn({ method: "POST" })
  .inputValidator((data: { itemIds?: string[]; stage?: string; deskToken?: string }) => {
    const stage = String(data?.stage);
    if (!["pending", "approved", "rejected", "duplicate"].includes(stage)) throw new Error("Invalid stage");
    return {
      itemIds: Array.isArray(data?.itemIds) ? data.itemIds.slice(0, 100).map(String) : [],
      stage,
      deskToken: typeof data?.deskToken === "string" ? data.deskToken : undefined,
    };
  })
  .handler(async ({ data }) => {
    const { assertDesk } = await import("@/lib/desk-session.server");
    await assertDesk(data.deskToken);
    const { admin } = await import("@/lib/cms.server");
    const { movePictureIntake } = await import("@/lib/picture-intake.server");
    return movePictureIntake(await admin(), data as Parameters<typeof movePictureIntake>[1]);
  });
/** Editor dislike: permanently delete pictures (intake + published copies). */
export const purgePictures = createServerFn({ method: "POST" })
  .inputValidator((data: { itemIds?: string[]; deskToken?: string }) => ({
    itemIds: Array.isArray(data?.itemIds) ? data.itemIds.slice(0, 200).map(String) : [],
    deskToken: typeof data?.deskToken === "string" ? data.deskToken : undefined,
  }))
  .handler(async ({ data }) => {
    const { assertDesk } = await import("@/lib/desk-session.server");
    await assertDesk(data.deskToken);
    const { purgePictureItems } = await import("@/lib/purge.server");
    return purgePictureItems(data.itemIds);
  });

/** Bulk approve + publish pictures in set-based statements. Always returns JSON. */
export const bulkApprovePictures = createServerFn({ method: "POST" })
  .inputValidator((data: { itemIds?: string[]; deskToken?: string }) => ({
    itemIds: Array.isArray(data?.itemIds) ? data.itemIds.slice(0, 200).map(String) : [],
    deskToken: typeof data?.deskToken === "string" ? data.deskToken : undefined,
  }))
  .handler(async ({ data }) => {
    try {
      const { assertDesk } = await import("@/lib/desk-session.server");
      await assertDesk(data.deskToken);
      const { admin } = await import("@/lib/cms.server");
      const { bulkApprovePictures: run } = await import("@/lib/picture-intake.server");
      return run(await admin(), data.itemIds);
    } catch (caught) {
      return {
        approved: 0,
        failed: data.itemIds,
        error: caught instanceof Error ? caught.message : "Bulk approval failed",
      };
    }
  });
