import { collectGallery } from "../src/lib/collect-news.server";
const rows = await collectGallery(undefined, { slice: 0, sliceSize: 80 });
const tags = rows.slice(0, 6).map((r) => ({ t: r.title.slice(0, 50), ...(r.payload as any) }));
console.log("candidates:", rows.length);
console.log(tags.map((x) => `${x.industry} | ${x.star} | ${x.event ?? "-"} | ${x.t}`).join("\n"));
const inds = new Map<string, number>();
for (const r of rows) { const i = (r.payload as any).industry; inds.set(i, (inds.get(i) ?? 0) + 1); }
console.log([...inds]);
