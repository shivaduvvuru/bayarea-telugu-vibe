import { useSession } from "@tanstack/react-start/server";
import { admin } from "@/lib/cms.server";

const sessionConfig = {
  password: process.env["DESK_SESSION_SECRET"]!,
  name: "desk-gate",
  maxAge: 60 * 60 * 24 * 30,
  cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
};

/**
 * Editor-only photo removal. A disliked picture is pulled from the newsroom for
 * everyone (status "removed", placement "hidden") so it cannot come back on a
 * later refresh or collection pass. Requires an unlocked desk session.
 */
export async function removePhoto(slug: string): Promise<{ removed: boolean; reason?: string }> {
  const session = await useSession<{ unlocked?: boolean }>(sessionConfig);
  if (!session.data.unlocked) return { removed: false, reason: "locked" };

  const id = slug.startsWith("c-") ? slug.slice(2) : slug;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { removed: false, reason: "unknown" };

  const db = await admin();
  const { data: row } = await db
    .from("content_items")
    .select("image_url")
    .eq("id", id)
    .maybeSingle();

  const { error } = await db
    .from("content_items")
    .update({ status: "removed", placement: "hidden" })
    .eq("id", id);
  if (error) return { removed: false, reason: error.message };

  // Same picture reused on another row (feeds often repeat artwork): pull those
  // too so the image never reappears.
  const image = (row as { image_url?: string | null } | null)?.image_url;
  if (image) {
    await db
      .from("content_items")
      .update({ status: "removed", placement: "hidden" })
      .eq("image_url", image)
      .neq("id", id);
  }

  return { removed: true };
}
