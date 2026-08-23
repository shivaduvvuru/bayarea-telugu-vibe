import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { PropertyVideoRow, PropertyVideoWithStats } from "@/lib/property-videos";

const featureId = z.string().trim().min(1).max(40);
const videoId = z.string().trim().regex(/^[a-zA-Z0-9_-]{11}$/);
const status = z.enum(["pending", "verified", "rejected"]);

/** Verified videos plus click totals for the public property grid. */
export const getPropertyVideos = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ videos: PropertyVideoRow[]; clicks: Record<string, number> }> => {
    const { readVerifiedVideos, readClickTotals } = await import("@/lib/property-videos.server");
    try {
      const [videos, clicks] = await Promise.all([readVerifiedVideos(), readClickTotals()]);
      return { videos, clicks };
    } catch (err) {
      console.error("getPropertyVideos failed", err);
      return { videos: [], clicks: {} };
    }
  },
);

/** Reader tapped a video thumbnail — logged for per-project engagement. */
export const trackPropertyVideoClick = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        featureId,
        videoId: videoId.optional(),
        project: z.string().trim().max(160).optional(),
        path: z.string().trim().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { recordVideoClick } = await import("@/lib/property-videos.server");
    await recordVideoClick(data);
    return { ok: true as const };
  });

/** Desk: every video row with its click count. */
export const listPropertyVideos = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ deskToken: z.string().max(400).optional() }).parse(input),
  )
  .handler(async ({ data }): Promise<{ videos: PropertyVideoWithStats[] }> => {
    const { assertDesk } = await import("@/lib/desk-session.server");
    await assertDesk(data.deskToken);
    const { readAllVideos } = await import("@/lib/property-videos.server");
    return { videos: await readAllVideos() };
  });

export const savePropertyVideo = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        deskToken: z.string().max(400).optional(),
        featureId,
        project: z.string().trim().min(2).max(160),
        developer: z.string().trim().max(160).optional(),
        videoId,
        title: z.string().trim().max(200).optional(),
        note: z.string().trim().max(600).optional(),
        status: status.default("pending"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { assertDesk } = await import("@/lib/desk-session.server");
    await assertDesk(data.deskToken);
    const { saveVideo } = await import("@/lib/property-videos.server");
    await saveVideo(data);
    return { ok: true as const };
  });

export const setPropertyVideoStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ deskToken: z.string().max(400).optional(), featureId, status })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { assertDesk } = await import("@/lib/desk-session.server");
    await assertDesk(data.deskToken);
    const { setVideoStatus } = await import("@/lib/property-videos.server");
    await setVideoStatus(data.featureId, data.status);
    return { ok: true as const };
  });

export const deletePropertyVideo = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ deskToken: z.string().max(400).optional(), featureId }).parse(input),
  )
  .handler(async ({ data }) => {
    const { assertDesk } = await import("@/lib/desk-session.server");
    await assertDesk(data.deskToken);
    const { removeVideo } = await import("@/lib/property-videos.server");
    await removeVideo(data.featureId);
    return { ok: true as const };
  });
