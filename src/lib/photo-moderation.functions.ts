import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Deletes a disliked picture site-wide when the caller has the desk unlocked. */
export const removeDislikedPhoto = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(2).max(80) }).parse(input))
  .handler(async ({ data }) => {
    const { removePhoto } = await import("@/lib/photo-moderation.server");
    return removePhoto(data.slug);
  });
