import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CLAIM_COLUMNS, type ClaimOverride, type DirectoryClaim } from "@/lib/claims";

const claimInput = z.object({
  listing_id: z.number().int().nonnegative(),
  listing_title: z.string().trim().min(1).max(200),
  claimant_name: z.string().trim().min(1).max(120),
  claimant_email: z.string().trim().email().max(255),
  claimant_phone: z.string().trim().max(40).optional().or(z.literal("")),
  claimant_role: z.string().trim().max(80).optional().or(z.literal("")),
  city: z.string().trim().max(60).optional().or(z.literal("")),
  address: z.string().trim().max(240).optional().or(z.literal("")),
  hours: z.string().trim().max(240).optional().or(z.literal("")),
  website: z.string().trim().max(240).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

const blank = (v?: string) => (v && v.length > 0 ? v : null);

/** A business owner claims a listing and sends corrections. Goes to review. */
export const submitClaim = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => claimInput.parse(input))
  .handler(async ({ data }) => {
    const { admin } = await import("@/lib/cms.server");
    const db = await admin();
    const { data: row, error } = await db
      .from("directory_claims")
      .insert({
        listing_id: data.listing_id,
        listing_title: data.listing_title,
        city: blank(data.city),
        address: blank(data.address),
        hours: blank(data.hours),
        website: blank(data.website),
        phone: blank(data.phone),
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    // Claimant contact details live in a private, staff-only table.
    const { error: contactError } = await db.from("directory_claim_contacts").insert({
      claim_id: row.id,
      claimant_name: data.claimant_name,
      claimant_email: data.claimant_email,
      claimant_phone: blank(data.claimant_phone),
      claimant_role: blank(data.claimant_role),
      notes: blank(data.notes),
    });
    if (contactError) throw new Error(contactError.message);
    return { ok: true as const };
  });

/** Approved corrections, keyed by WordPress listing id. Public + SSR safe. */
export const listClaimOverrides = createServerFn({ method: "GET" }).handler(
  async (): Promise<ClaimOverride[]> => {
    try {
      const { publicClient } = await import("@/lib/cms.server");
      const { data, error } = await publicClient()
        .from("directory_claims")
        .select("listing_id, city, address, hours, website, phone")
        .eq("status", "approved")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ClaimOverride[];
    } catch (err) {
      console.error("listClaimOverrides failed", err);
      return [];
    }
  },
);

/** Newsroom queue of claims awaiting a decision. */
export const listClaims = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ status: z.enum(["pending", "approved", "rejected"]).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<DirectoryClaim[]> => {
    const { assertStaff, admin } = await import("@/lib/cms.server");
    await assertStaff(context.supabase as never, context.userId);
    // Claimant contact fields live in a private table, so read them with the
    // trusted server client after the staff check above.
    const db = await admin();
    const { data: rows, error } = await db
      .from("directory_claims")
      .select(CLAIM_COLUMNS)
      .eq("status", data.status ?? "pending")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const base = (rows ?? []) as Array<Record<string, unknown> & { id: string }>;
    if (base.length === 0) return [];
    const { data: contacts } = await db
      .from("directory_claim_contacts")
      .select("claim_id, claimant_name, claimant_email, claimant_phone, claimant_role, notes")
      .in(
        "claim_id",
        base.map((r) => r.id),
      );
    const byClaim = new Map((contacts ?? []).map((c) => [c.claim_id, c]));
    return base.map((r) => {
      const c = byClaim.get(r.id);
      return {
        ...r,
        claimant_name: c?.claimant_name ?? "",
        claimant_email: c?.claimant_email ?? "",
        claimant_phone: c?.claimant_phone ?? null,
        claimant_role: c?.claimant_role ?? null,
        notes: c?.notes ?? null,
      };
    }) as unknown as DirectoryClaim[];
  });

/** Approve or reject a claim. Approved corrections go live on the directory. */
export const reviewClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["approved", "rejected"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertStaff } = await import("@/lib/cms.server");
    await assertStaff(context.supabase as never, context.userId);
    const { error } = await context.supabase
      .from("directory_claims")
      .update({
        status: data.status,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
