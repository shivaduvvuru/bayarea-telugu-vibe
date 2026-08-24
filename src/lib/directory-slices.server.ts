import { BAY_AREA_COUNTIES } from "@/lib/directory-geo";
import { DIRECTORY_TAXONOMY, osmSubcategories } from "@/lib/directory-taxonomy";

export interface DirectorySlice {
  county: string;
  category: string;
}

type Db = {
  from: (table: string) => any;
};

/**
 * Every (county, OSM-backed category) pair, in a stable order. The scheduled
 * hook walks this list a slice at a time so an hour of runs eventually covers
 * all nine counties and every category, then wraps around to refresh stale rows.
 */
export function directorySlices(): DirectorySlice[] {
  const categories = DIRECTORY_TAXONOMY.filter(
    (c) => osmSubcategories([c.key]).length > 0,
  ).map((c) => c.key);
  const slices: DirectorySlice[] = [];
  for (const county of BAY_AREA_COUNTIES) {
    for (const category of categories) slices.push({ county: county.key, category });
  }
  return slices;
}

/** Read the persisted cursor (0 when the row or table is empty). */
export async function readSliceCursor(db: Db): Promise<number> {
  const { data } = await db
    .from("directory_ingest_state")
    .select("cursor_index")
    .eq("id", "osm")
    .maybeSingle();
  const value = Number((data as { cursor_index?: number } | null)?.cursor_index ?? 0);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

/** Advance the cursor, wrapping at the end of the slice list. */
export async function writeSliceCursor(
  db: Db,
  next: number,
  total: number,
  lastSlice: string,
): Promise<void> {
  await db.from("directory_ingest_state").upsert(
    {
      id: "osm",
      cursor_index: total > 0 ? next % total : 0,
      total_slices: total,
      last_slice: lastSlice,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
}
