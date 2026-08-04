/**
 * Refreshes the committed temple announcement snapshot.
 *   bun run snapshot:temples
 */
import { writeFileSync } from "node:fs";
import { fetchAllTemples } from "../src/lib/temples.server";

const results = await fetchAllTemples();
const snapshot = {
  generatedAt: new Date().toISOString(),
  temples: results.map((r) => ({
    id: r.source.id,
    name: r.source.name,
    city: r.source.city,
    region: r.source.region,
    site: r.source.site,
    ok: r.ok,
    announcements: r.announcements,
  })),
};
writeFileSync("src/content/temple-snapshot.json", `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(
  `temples ok: ${results.filter((r) => r.ok).length}/${results.length}, announcements: ${results.reduce((n, r) => n + r.announcements.length, 0)}`,
);
