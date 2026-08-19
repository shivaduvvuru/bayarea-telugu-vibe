/** Site-wide like tally. Uses the service-role client; input is validated by the caller. */
export async function bumpLike(slug: string, delta: 1 | -1): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.rpc("bump_photo_like" as never, {
    _slug: slug,
    _delta: delta,
  } as never);
  if (error) console.error("[photo-likes] tally failed", error.message);
}
