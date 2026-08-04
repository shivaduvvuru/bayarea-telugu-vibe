import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const input = z.object({
  email: z.string().trim().email().max(160),
  city: z.string().trim().min(2).max(60),
});

/** Public sign-up for the weekly per-city roundup. */
export const subscribeToCityDigest = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => input.parse(raw))
  .handler(async ({ data }) => {
    const { admin } = await import("@/lib/cms.server");
    const db = await admin();
    const { error } = await db
      .from("digest_subscribers")
      .upsert(
        { email: data.email.toLowerCase(), city: data.city, unsubscribed_at: null },
        { onConflict: "email,city" },
      );
    if (error) throw new Error("Could not save your subscription. Please try again.");
    return { ok: true as const };
  });