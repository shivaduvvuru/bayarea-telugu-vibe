import { createServerFn } from "@tanstack/react-start";

/**
 * Records that these Glamour pictures have just been displayed.
 *
 * The nightly rotation puts least-recently-shown pictures first, so every
 * screenful the reader actually sees has to stamp itself; without this the
 * folder would keep leading with the same photos.
 */
export const markGlamourShown = createServerFn({ method: "POST" })
  .inputValidator((input: { slugs: string[] }) => ({
    slugs: (Array.isArray(input?.slugs) ? input.slugs : []).slice(0, 100).map(String),
  }))
  .handler(async ({ data }): Promise<{ stamped: number }> => {
    // Slugs are `c-<uuid>`; anything else is not a stored picture row.
    const ids = data.slugs
      .map((s) => (s.startsWith("c-") ? s.slice(2) : s))
      .filter((s) => /^[0-9a-f-]{36}$/i.test(s));
    if (!ids.length) return { stamped: 0 };
    const { admin } = await import("@/lib/cms.server");
    const db = await admin();
    const { error } = await db
      .from("content_items")
      .update({ last_shown_at: new Date().toISOString() } as never)
      .in("id", ids);
    if (error) return { stamped: 0 };
    return { stamped: ids.length };
  });
