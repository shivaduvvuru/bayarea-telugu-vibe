import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { submitRestaurantClaim } from "@/lib/food.functions";
import { FOOD_CITIES } from "@/lib/food";

const TITLE = "Add or Claim Your Bay Area Restaurant | Times Bay Area Food";
const DESC =
  "Restaurant owners: add a new listing or claim an existing one — hours, menu, photos, delivery links, reservations, catering and specials. Free, editor-reviewed.";

export const Route = createFileRoute("/food/add")({
  validateSearch: zodValidator(
    z.object({ claim: fallback(z.string(), "").default("") }),
  ),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AddClaimPage,
});

const field = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink";
const label = "block text-xs font-semibold text-ink";

const DETAIL_FIELDS = [
  ["address", "Street address"],
  ["phone", "Phone"],
  ["website", "Website"],
  ["menu_url", "Menu link"],
  ["hours", "Hours"],
  ["cuisines", "Cuisines (comma separated)"],
  ["dishes", "Signature dishes"],
  ["delivery_links", "Delivery / ordering links"],
  ["reservation_link", "Reservation link"],
  ["catering", "Catering details"],
  ["specials", "Current specials or coupons"],
  ["photos", "Photo links"],
  ["notes", "Anything else"],
] as const;

function AddClaimPage() {
  const { claim } = Route.useSearch();
  const send = useServerFn(submitRestaurantClaim);
  const [kind, setKind] = useState<"add" | "claim">(claim ? "claim" : "add");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState<Record<string, string>>({
    restaurant_name: "",
    city: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    contact_role: "Owner",
  });

  const set = (k: string) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const details: Record<string, string> = {};
      for (const [key] of DETAIL_FIELDS) if (form[key]) details[key] = form[key]!;
      if (claim) details["claiming_listing"] = claim;
      await send({
        data: {
          kind,
          restaurant_name: form["restaurant_name"] ?? "",
          city: form["city"] ?? null,
          contact_name: form["contact_name"] ?? "",
          contact_email: form["contact_email"] ?? "",
          contact_phone: form["contact_phone"] ?? null,
          contact_role: form["contact_role"] ?? null,
          details,
        },
      });
      setMsg({
        ok: true,
        text: "Thanks — our editors verify every submission before it appears on the site.",
      });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-5">
      <h1 className="text-lg font-extrabold text-ink">
        {kind === "claim" ? "Claim this restaurant" : "Add your restaurant"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Free listing. Everything you send is reviewed by a Times Bay Area editor before publishing,
        and verified businesses carry a “Verified Restaurant” badge.
      </p>

      <div className="mt-3 flex gap-2">
        {(["add", "claim"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`min-h-10 rounded-full border px-3 text-xs font-semibold ${
              kind === k
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-ink"
            }`}
          >
            {k === "add" ? "Add a new restaurant" : "Claim an existing listing"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className={label}>
          Restaurant name
          <input required value={form["restaurant_name"]} onChange={set("restaurant_name")} className={field} />
        </label>
        <label className={label}>
          City
          <select value={form["city"]} onChange={set("city")} className={field}>
            <option value="">Select a city</option>
            {FOOD_CITIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          Your name
          <input required value={form["contact_name"]} onChange={set("contact_name")} className={field} />
        </label>
        <label className={label}>
          Your email
          <input
            required
            type="email"
            value={form["contact_email"]}
            onChange={set("contact_email")}
            className={field}
          />
        </label>
        <label className={label}>
          Your phone (optional)
          <input value={form["contact_phone"]} onChange={set("contact_phone")} className={field} />
        </label>
        <label className={label}>
          Your role
          <input value={form["contact_role"]} onChange={set("contact_role")} className={field} />
        </label>

        {DETAIL_FIELDS.map(([key, text]) => (
          <label key={key} className={`${label} sm:col-span-2`}>
            {text}
            {key === "notes" || key === "hours" || key === "catering" ? (
              <textarea rows={2} value={form[key] ?? ""} onChange={set(key)} className={field} />
            ) : (
              <input value={form[key] ?? ""} onChange={set(key)} className={field} />
            )}
          </label>
        ))}

        {msg && (
          <p className={`sm:col-span-2 text-xs ${msg.ok ? "text-primary" : "text-destructive"}`}>
            {msg.text}
          </p>
        )}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Sending…" : "Submit for review"}
          </button>
        </div>
      </form>
    </div>
  );
}
