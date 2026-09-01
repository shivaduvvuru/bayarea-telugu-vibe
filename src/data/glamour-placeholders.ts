/**
 * Demo Glamour set — stock placeholder photography from Unsplash.
 *
 * These are stand-ins only. To use your own pictures, drop the files into
 * `public/images/glamour/` and change `src` to `/images/glamour/<file>.jpg`.
 */
export type GlamourShot = {
  id: string;
  src: string;
  title: string;
  credit: string;
  tags: string[];
};

const u = (id: string, w = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&q=80&w=${w}`;

export const GLAMOUR_PLACEHOLDERS: GlamourShot[] = [
  { id: "g1", src: u("photo-1524504388940-b1c1722653e1"), title: "Soft key light portrait", credit: "Unsplash", tags: ["Portrait", "Studio"] },
  { id: "g2", src: u("photo-1503104834685-7205e8607eb9"), title: "Editorial pose in colour", credit: "Unsplash", tags: ["Editorial", "Fashion"] },
  { id: "g3", src: u("photo-1529626455594-4ff0802cfb7e"), title: "Golden hour glamour", credit: "Unsplash", tags: ["Portrait", "Natural light"] },
  { id: "g4", src: u("photo-1517841905240-472988babdf9"), title: "Classic beauty headshot", credit: "Unsplash", tags: ["Beauty", "Studio"] },
  { id: "g5", src: u("photo-1488426862026-3ee34a7d66df"), title: "Window light study", credit: "Unsplash", tags: ["Portrait", "Natural light"] },
  { id: "g6", src: u("photo-1502823403499-6ccfcf4fb453"), title: "Monochrome mood", credit: "Unsplash", tags: ["Editorial", "Portrait"] },
  { id: "g7", src: u("photo-1520295187453-cd239786490c"), title: "Runway attitude", credit: "Unsplash", tags: ["Fashion", "Editorial"] },
  { id: "g8", src: u("photo-1534528741775-53994a69daeb"), title: "Contrast lighting test", credit: "Unsplash", tags: ["Studio", "Beauty"] },
  { id: "g9", src: u("photo-1531746020798-e6953c6e8e04"), title: "Clean studio frame", credit: "Unsplash", tags: ["Studio", "Portrait"] },
  { id: "g10", src: u("photo-1516726817505-f5ed825624d8"), title: "Evening couture", credit: "Unsplash", tags: ["Fashion", "Editorial"] },
  { id: "g11", src: u("photo-1508214751196-bcfd4ca60f91"), title: "Shadow play", credit: "Unsplash", tags: ["Editorial", "Studio"] },
  { id: "g12", src: u("photo-1494790108377-be9c29b29330"), title: "Everyday elegance", credit: "Unsplash", tags: ["Portrait", "Beauty"] },
  { id: "g13", src: u("photo-1509967419530-da38b4704bc6"), title: "Cover-style crop", credit: "Unsplash", tags: ["Fashion", "Beauty"] },
  { id: "g14", src: u("photo-1512310604669-443f26c35f52"), title: "Backlit silhouette", credit: "Unsplash", tags: ["Editorial", "Natural light"] },
  { id: "g15", src: u("photo-1485217988980-11786ced9454"), title: "Rim-lit profile", credit: "Unsplash", tags: ["Studio", "Portrait"] },
  { id: "g16", src: u("photo-1544005313-94ddf0286df2"), title: "Warm tone sitting", credit: "Unsplash", tags: ["Portrait", "Beauty"] },
  { id: "g17", src: u("photo-1546961329-78bef0414d7c"), title: "Street couture", credit: "Unsplash", tags: ["Fashion", "Natural light"] },
  { id: "g18", src: u("photo-1499651681375-8afc5a4db253"), title: "High-key beauty", credit: "Unsplash", tags: ["Beauty", "Studio"] },
];

export const GLAMOUR_TAGS = ["Portrait", "Studio", "Editorial", "Fashion", "Beauty", "Natural light"];
