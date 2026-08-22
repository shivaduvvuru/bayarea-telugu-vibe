/**
 * Writes for the Food section: owner submissions and community reviews.
 * Kept out of the read module so validation and anti-spam rules live in one
 * place.
 */

import { saveClaim as persistClaim, type ClaimInput } from "@/lib/food.server";

export { persistClaim as saveClaim };

const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/** Rejects obviously bad or spam-shaped owner submissions before storing them. */
export function validateClaim(input: ClaimInput): ClaimInput {
  const name = input.restaurant_name?.trim() ?? "";
  if (name.length < 2) throw new Error("Please enter the restaurant name.");
  if (!input.contact_name?.trim()) throw new Error("Please enter your name.");
  if (!EMAIL.test(input.contact_email ?? "")) throw new Error("Please enter a valid email address.");
  const details = Object.fromEntries(
    Object.entries(input.details ?? {})
      .filter(([, v]) => typeof v === "string" && v.trim() !== "")
      .map(([k, v]) => [k, String(v).slice(0, 2000)]),
  );
  const linkCount = Object.values(details).filter((v) => /https?:\/\//i.test(v)).length;
  if (linkCount > 8) throw new Error("Too many links in this submission.");
  return {
    ...input,
    kind: input.kind === "add" ? "add" : "claim",
    restaurant_name: name.slice(0, 200),
    city: input.city?.trim() || null,
    contact_name: input.contact_name.trim().slice(0, 120),
    contact_email: input.contact_email.trim().slice(0, 200),
    contact_phone: input.contact_phone?.trim() || null,
    contact_role: input.contact_role?.trim() || null,
    details,
  };
}

type Client = {
  from: (table: string) => any;
};

type ReviewInput = {
  restaurant_id: string;
  rating: number;
  body?: string | undefined;
  dishes?: string[] | undefined;
  photos?: string[] | undefined;
  veg_favorite?: boolean | undefined;
  family_friendly?: boolean | undefined;
  recommends?: boolean | undefined;
};

function displayName(claims: Record<string, unknown> | null | undefined) {
  const meta = (claims?.["user_metadata"] ?? {}) as Record<string, unknown>;
  const name = (meta["full_name"] ?? meta["name"] ?? claims?.["email"]) as string | undefined;
  if (!name) return "Community member";
  // Emails are never shown in full.
  return name.includes("@") ? `${name.split("@")[0]}` : name.slice(0, 60);
}

/**
 * One review per person per restaurant, written as that user so row-level
 * security — not our code — is the thing that guarantees ownership.
 */
export async function upsertReview(
  supabase: unknown,
  userId: string,
  claims: Record<string, unknown> | null | undefined,
  input: ReviewInput,
) {
  const rating = Math.round(Number(input.rating));
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) throw new Error("Pick 1 to 5 stars.");
  const body = (input.body ?? "").trim().slice(0, 1500);
  if (body && body.length < 10) throw new Error("Please write at least a sentence.");
  const dishes = (input.dishes ?? []).map((d) => d.trim()).filter(Boolean).slice(0, 8);
  const photos = (input.photos ?? []).filter((p) => /^https?:\/\//i.test(p)).slice(0, 6);

  const db = supabase as Client;
  const { data, error } = await db
    .from("restaurant_reviews")
    .upsert(
      {
        restaurant_id: input.restaurant_id,
        user_id: userId,
        author_name: displayName(claims),
        rating,
        body: body || null,
        dishes,
        photos,
        veg_favorite: Boolean(input.veg_favorite),
        family_friendly: Boolean(input.family_friendly),
        recommends: input.recommends !== false,
        status: "published",
      },
      { onConflict: "restaurant_id,user_id" },
    )
    .select("id, rating")
    .single();
  if (error) throw new Error(error.message);
  return data as { id: string; rating: number };
}

export async function readMyReview(supabase: unknown, userId: string, restaurantId: string) {
  const db = supabase as Client;
  const { data } = await db
    .from("restaurant_reviews")
    .select("id, rating, body, dishes, veg_favorite, family_friendly, recommends")
    .eq("user_id", userId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  return (data ?? null) as null | {
    id: string;
    rating: number;
    body: string | null;
    dishes: string[];
    veg_favorite: boolean;
    family_friendly: boolean;
    recommends: boolean;
  };
}
