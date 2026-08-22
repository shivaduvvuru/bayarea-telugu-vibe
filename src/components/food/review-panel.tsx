import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyReview, saveRestaurantReview } from "@/lib/food.functions";
import type { CommunityReview } from "@/lib/food";

const field = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink";

/** Community reviews plus the signed-in reader's own rating form. */
export function ReviewPanel({
  restaurantId,
  restaurantName,
  reviews,
}: {
  restaurantId: string;
  restaurantName: string;
  reviews: CommunityReview[];
}) {
  const save = useServerFn(saveRestaurantReview);
  const readMine = useServerFn(fetchMyReview);
  const [signedIn, setSignedIn] = useState(false);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [dishes, setDishes] = useState("");
  const [veg, setVeg] = useState(false);
  const [family, setFamily] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const has = Boolean(data.session);
      setSignedIn(has);
      if (!has) return;
      try {
        const mine = await readMine({ data: { restaurant_id: restaurantId } });
        if (!active || !mine) return;
        setRating(mine.rating);
        setBody(mine.body ?? "");
        setDishes(mine.dishes.join(", "));
        setVeg(mine.veg_favorite);
        setFamily(mine.family_friendly);
      } catch {
        /* first-time reviewer */
      }
    });
    return () => {
      active = false;
    };
  }, [restaurantId, readMine]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      setMsg({ ok: false, text: "Pick a star rating first." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await save({
        data: {
          restaurant_id: restaurantId,
          rating,
          body,
          dishes: dishes.split(",").map((d) => d.trim()).filter(Boolean),
          veg_favorite: veg,
          family_friendly: family,
        },
      });
      setMsg({ ok: true, text: "Thanks — your review is live." });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Could not save that." });
    } finally {
      setBusy(false);
    }
  }

  const popular = [...new Set(reviews.flatMap((r) => r.dishes))].slice(0, 6);
  const vegCount = reviews.filter((r) => r.veg_favorite).length;
  const familyCount = reviews.filter((r) => r.family_friendly).length;

  return (
    <section className="mt-6 border-t border-border pt-5">
      <h2 className="text-base font-bold text-ink">TimesBayArea community reviews</h2>

      {reviews.length > 0 && (
        <div className="mt-1 text-xs text-muted-foreground">
          {popular.length > 0 && (
            <p>
              <span className="font-semibold text-ink">Readers recommend:</span> {popular.join(", ")}
            </p>
          )}
          {vegCount > 0 && <p>{vegCount} marked it a vegetarian favourite</p>}
          {familyCount > 0 && <p>{familyCount} said it works well for families</p>}
        </div>
      )}

      <ul className="mt-3 space-y-3">
        {reviews.map((r) => (
          <li key={r.id} className="border-b border-border pb-3">
            <p className="text-sm font-semibold text-ink">
              {r.author_name} · {r.rating}★
            </p>
            {r.body && <p className="mt-0.5 text-sm text-ink">{r.body}</p>}
            {r.dishes.length > 0 && (
              <p className="mt-0.5 text-xs text-muted-foreground">Dishes: {r.dishes.join(", ")}</p>
            )}
          </li>
        ))}
        {reviews.length === 0 && (
          <li className="text-sm text-muted-foreground">
            No community reviews for {restaurantName} yet.
          </li>
        )}
      </ul>

      {signedIn ? (
        <form onSubmit={submit} className="mt-4 rounded-lg border border-border bg-card p-3">
          <p className="text-sm font-bold text-ink">Rate this restaurant</p>
          <div className="mt-2 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                onClick={() => setRating(n)}
                className="min-h-11 px-1"
              >
                <Star
                  className={`h-6 w-6 ${n <= rating ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`}
                  aria-hidden
                />
              </button>
            ))}
          </div>
          <label className="mt-2 block text-xs font-semibold text-ink">
            Your review
            <textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What was good, what to order, how the service was"
              className={field}
            />
          </label>
          <label className="mt-2 block text-xs font-semibold text-ink">
            Dishes you recommend (comma separated)
            <input value={dishes} onChange={(e) => setDishes(e.target.value)} className={field} />
          </label>
          <div className="mt-2 flex flex-wrap gap-4 text-xs font-semibold text-ink">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={veg} onChange={(e) => setVeg(e.target.checked)} />
              Great vegetarian options
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={family} onChange={(e) => setFamily(e.target.checked)} />
              Best for families
            </label>
          </div>
          {msg && (
            <p className={`mt-2 text-xs ${msg.ok ? "text-primary" : "text-destructive"}`}>{msg.text}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="mt-3 min-h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Saving…" : "Post review"}
          </button>
          <p className="mt-2 text-[11px] text-muted-foreground">
            One review per reader per restaurant. Editors remove spam and fake reviews.
          </p>
        </form>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          <Link to="/auth" className="font-semibold text-primary">
            Sign in
          </Link>{" "}
          to rate {restaurantName}, recommend dishes and mark vegetarian or family favourites.
        </p>
      )}
    </section>
  );
}
