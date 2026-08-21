import { createServerFn } from "@tanstack/react-start";
import type { Headline } from "./headline.server";

/** Public: the active City News headline, with fallback to the newest city story. */
export const getCityHeadline = createServerFn({ method: "GET" }).handler(
  async (): Promise<Headline | null> => {
    try {
      const { readHeadline } = await import("./headline.server");
      return await readHeadline();
    } catch (err) {
      console.error("getCityHeadline failed", err);
      return null;
    }
  },
);

/** Editorial desk: pin a story as the City News headline (or clear the pin). */
export const setCityHeadline = createServerFn({ method: "POST" })
  .inputValidator((input: { deskToken?: string; slug?: string | null; label?: string | null }) => ({
    deskToken: input?.deskToken,
    slug: input?.slug ? String(input.slug).slice(0, 200) : null,
    label: input?.label ? String(input.label).slice(0, 40) : null,
  }))
  .handler(async ({ data }) => {
    const { assertDesk } = await import("./desk-session.server");
    await assertDesk(data.deskToken);
    const { writeHeadline } = await import("./headline.server");
    const contentId = data.slug?.startsWith("c-") ? data.slug.slice(2) : null;
    return writeHeadline(contentId, data.label);
  });
