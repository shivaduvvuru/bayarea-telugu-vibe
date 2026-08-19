import { admin } from "@/lib/cms.server";
import { CINEMA_SLUG } from "@/lib/cinema-topics";
import { countPeopleInPhotos } from "@/lib/photo-subject.server";

export type SoloSweepResult = {
  /** Photos screened in this pass. */
  checked: number;
  /** Group photos (2+ people) moved out of Glamour into Cinema/OTT. */
  moved: number;
  /** Confirmed solo photos that stay in the Glamour folder. */
  solo: number;
  /** Photos the screen could not judge — left in place for the next pass. */
  unchecked: number;
};

/**
 * Keeps the Glamour folder strictly solo. Every Glamour picture is screened for
 * how many people are in the frame; anything with two or more is re-filed under
 * Cinema/OTT, where group and event photography belongs. Single-person photos
 * are stamped so a later pass skips them, and photos the screen cannot judge are
 * left untouched so nothing is moved on a guess.
 */
export async function sweepGlamourGroupPhotos(
  limit = 24,
  { recheck = false }: { recheck?: boolean } = {},
): Promise<SoloSweepResult> {
  const db = await admin();
  let query = db
    .from("content_items")
    .select("id,image_url")
    .eq("category", "gallery")
    .in("status", ["published", "archived", "pending"])
    .not("image_url", "is", null);
  if (!recheck) query = query.is("people_checked_at", null);

  const { data: rows } = await query
    .order("published_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 120)));

  const items = (rows ?? []) as { id: string; image_url: string | null }[];
  const candidates = items.flatMap((row) =>
    row.image_url ? [{ id: row.id, image: row.image_url }] : [],
  );
  if (!candidates.length) return { checked: 0, moved: 0, solo: 0, unchecked: 0 };

  const counts = await countPeopleInPhotos(candidates, process.env["LOVABLE_API_KEY"]);
  const group = candidates.filter((c) => (counts.get(c.id) ?? 0) > 1).map((c) => c.id);
  const solo = candidates
    .filter((c) => counts.has(c.id) && (counts.get(c.id) ?? 0) <= 1)
    .map((c) => c.id);
  const stampedAt = new Date().toISOString();

  for (let i = 0; i < group.length; i += 50) {
    const slice = group.slice(i, i + 50);
    await db
      .from("content_items")
      // Re-filed as Cinema/OTT so the picture is still on the site, just in the
      // right section, and never returns to the Glamour views.
      .update({
        category: CINEMA_SLUG,
        people_checked_at: stampedAt,
        status: "published",
        placement: "auto",
      } as never)
      .in("id", slice);
    for (const id of slice) {
      const n = counts.get(id) ?? 2;
      await db.from("content_items").update({ people_count: n } as never).eq("id", id);
    }
  }

  for (const id of solo) {
    await db
      .from("content_items")
      .update({ people_checked_at: stampedAt, people_count: counts.get(id) ?? 1 } as never)
      .eq("id", id);
  }

  return {
    checked: candidates.length,
    moved: group.length,
    solo: solo.length,
    unchecked: candidates.length - group.length - solo.length,
  };
}
