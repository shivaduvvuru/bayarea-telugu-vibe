/**
 * Cost protection for optional paid enrichment providers.
 *
 * Every provider (Foursquare, Yelp, Google Places) has a row in
 * `external_api_budget` holding an on/off switch, a monthly USD limit
 * (default $10) and this month's call/spend counters. Paid calls must pass
 * through `assertBudget` first, so the directory can never quietly run up a
 * bill: when the projected spend crosses the limit the call is refused and the
 * desk has to raise the limit deliberately.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Db = SupabaseClient<Database>;

export type BudgetRow = {
  provider: string;
  enabled: boolean;
  monthly_limit_usd: number;
  cost_per_1k_usd: number;
  month: string;
  calls: number;
  spend_usd: number;
};

export function currentMonth(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

export async function listBudgets(db: Db): Promise<BudgetRow[]> {
  const { data, error } = await db
    .from("external_api_budget")
    .select("provider, enabled, monthly_limit_usd, cost_per_1k_usd, month, calls, spend_usd")
    .order("provider");
  if (error) throw error;
  const month = currentMonth();
  return ((data ?? []) as unknown as BudgetRow[]).map((row) =>
    row.month === month ? row : { ...row, month, calls: 0, spend_usd: 0 },
  );
}

export async function updateBudget(
  db: Db,
  provider: string,
  patch: { enabled?: boolean; monthly_limit_usd?: number },
): Promise<BudgetRow> {
  const update: Record<string, unknown> = {};
  if (typeof patch.enabled === "boolean") update["enabled"] = patch.enabled;
  if (typeof patch.monthly_limit_usd === "number") {
    update["monthly_limit_usd"] = Math.min(Math.max(patch.monthly_limit_usd, 0), 500);
  }
  const { data, error } = await db
    .from("external_api_budget")
    .update(update as never)
    .eq("provider", provider)
    .select("provider, enabled, monthly_limit_usd, cost_per_1k_usd, month, calls, spend_usd")
    .maybeSingle();
  if (error || !data) throw error ?? new Error(`Unknown provider ${provider}`);
  return data as unknown as BudgetRow;
}

/**
 * Confirms `calls` paid requests fit inside this month's limit for a provider.
 * Throws with a plain-language reason when the provider is off or capped.
 */
export async function assertBudget(db: Db, provider: string, calls: number): Promise<BudgetRow> {
  const { data, error } = await db
    .from("external_api_budget")
    .select("provider, enabled, monthly_limit_usd, cost_per_1k_usd, month, calls, spend_usd")
    .eq("provider", provider)
    .maybeSingle();
  if (error || !data) throw error ?? new Error(`Unknown provider ${provider}`);
  const row = data as unknown as BudgetRow;
  const month = currentMonth();
  const used = row.month === month ? Number(row.spend_usd) : 0;
  if (!row.enabled) {
    throw new Error(`${provider} enrichment is switched off — enable it on the food ingest desk.`);
  }
  const projected = used + (calls * Number(row.cost_per_1k_usd)) / 1000;
  if (projected > Number(row.monthly_limit_usd)) {
    throw new Error(
      `${provider} would exceed the $${Number(row.monthly_limit_usd).toFixed(2)} monthly limit ` +
        `($${used.toFixed(2)} used). Raise the limit to continue.`,
    );
  }
  return { ...row, month, calls: row.month === month ? row.calls : 0, spend_usd: used };
}

/** Records paid calls after they happen, rolling the month over when needed. */
export async function recordCalls(db: Db, provider: string, calls: number): Promise<void> {
  if (calls <= 0) return;
  const row = await assertBudget(db, provider, 0).catch(() => null);
  const costPer1k = Number(row?.cost_per_1k_usd ?? 0);
  const month = currentMonth();
  const priorCalls = row?.month === month ? Number(row?.calls ?? 0) : 0;
  const priorSpend = row?.month === month ? Number(row?.spend_usd ?? 0) : 0;
  await db
    .from("external_api_budget")
    .update({
      month,
      calls: priorCalls + calls,
      spend_usd: priorSpend + (calls * costPer1k) / 1000,
    } as never)
    .eq("provider", provider);
}
