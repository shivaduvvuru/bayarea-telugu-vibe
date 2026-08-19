import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Records a reader's like/unlike for a photo. Runs server-side so the
 * privileged tally function is never callable directly by browsers.
 */
export const bumpPhotoLike = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        slug: z
          .string()
          .min(2)
          .max(120)
          .regex(/^[a-zA-Z0-9._-]+$/),
        delta: z.union([z.literal(1), z.literal(-1)]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { bumpLike } = await import("@/lib/photo-likes.server");
    await bumpLike(data.slug, data.delta);
    return { ok: true };
  });
