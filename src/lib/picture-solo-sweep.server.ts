import { admin } from "@/lib/cms.server";
import { purgePictureItems } from "@/lib/purge.server";
import { countPeopleInPhotos, verifySoloWomanPhotos } from "@/lib/photo-subject.server";

export type SoloIntakeSweep = {
  /** Photos visually screened in this pass. */
  screened: number;
  /** Confirmed single-woman photos kept in Ready for Review. */
  kept: number;
  /** Group, non-woman or unsafe photos permanently deleted. */
  deleted: number;
  /** Photos the screen could not judge — left for the next pass. */
  undecided: number;
};

/**
 * Ready for Review holds single-woman glamour photos only. Every pass screens a
 * bounded batch of not-yet-verified intake rows: a photo is kept only when the
 * safety screen sees one adult woman as the dominant subject AND the people
 * count is at most one. Anything else (groups, men, non-photographs, unsafe
 * frames) is deleted site-wide through the normal picture purge so it cannot be
 * re-collected. Photos the screen cannot judge stay unverified and are retried,
 * never admitted on a guess.
 */
export async function sweepIntakeToSoloWomen(limit = 40): Promise<SoloIntakeSweep> {
  const db = await admin();
  const { data: rows } = await db
    .from("picture_intake")
    .select("item_id,image_url")
    .in("stage", ["usable", "pending"])
    .neq("screening_state", "passed")
    .not("image_url", "is", null)
    .order("discovered_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 120)));

  const candidates = ((rows ?? []) as Array<{ item_id: string; image_url: string | null }>).flatMap(
    (row) => (row.image_url ? [{ id: row.item_id, image: row.image_url }] : []),
  );
  if (!candidates.length) return { screened: 0, kept: 0, deleted: 0, undecided: 0 };

  const apiKey = process.env["LOVABLE_API_KEY"];
  // Without a screening key nothing can be verified — leave the batch alone
  // rather than deleting photos that were never actually judged.
  if (!apiKey) return { screened: 0, kept: 0, deleted: 0, undecided: candidates.length };

  const verification = await verifySoloWomanPhotos(candidates, apiKey);
  const judged = candidates.filter((c) => !verification.unchecked.has(c.id));
  const safe = judged.filter((c) => !verification.rejected.has(c.id));
  const counts = await countPeopleInPhotos(safe, apiKey);

  const keep = safe.filter((c) => counts.get(c.id) === 1).map((c) => c.id);
  const drop = judged
    .filter((c) => !keep.includes(c.id))
    // A missing people count means the count call failed; retry instead of delete.
    .filter((c) => verification.rejected.has(c.id) || counts.has(c.id))
    .map((c) => c.id);

  if (keep.length) {
    await db
      .from("picture_intake")
      .update({ screening_state: "passed", safety_reason: null, people_verified_at: new Date().toISOString() } as never)
      .in("item_id", keep);
  }
  if (drop.length) await purgePictureItems(drop);

  return {
    screened: judged.length,
    kept: keep.length,
    deleted: drop.length,
    undecided: candidates.length - judged.length,
  };
}
