import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { submitClaim } from "@/lib/claims.functions";
import { CITY_REGIONS } from "@/lib/wp";

const ALL_CITIES = CITY_REGIONS.flatMap((r) => r.cities.map((c) => c.en));

const field = "mt-1 w-full border border-border bg-background px-3 py-2 text-sm text-foreground";

/**
 * Lets a business owner claim a WordPress listing and correct the details we
 * could not read from the imported address line — above all the city.
 */
export function ClaimForm({
  listingId,
  listingTitle,
  suggestedCity,
  onClose,
}: {
  listingId: number;
  listingTitle: string;
  suggestedCity: string | null;
  onClose: () => void;
}) {
  const send = useServerFn(submitClaim);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({
    claimant_name: "",
    claimant_email: "",
    claimant_phone: "",
    claimant_role: "Owner",
    city: suggestedCity ?? "",
    address: "",
    hours: "",
    website: "",
    phone: "",
    notes: "",
  });

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await send({ data: { listing_id: listingId, listing_title: listingTitle, ...form } });
      setMsg({
        ok: true,
        text: "Thanks — an editor will verify your claim and publish the corrections.",
      });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 border-t border-border pt-3 text-left">
      <p className="text-sm font-bold text-ink">Claim this listing</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Correct the city, address and hours. We verify before publishing.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-ink">
          Your name
          <input required value={form.claimant_name} onChange={set("claimant_name")} className={field} />
        </label>
        <label className="text-xs font-semibold text-ink">
          Email
          <input required type="email" value={form.claimant_email} onChange={set("claimant_email")} className={field} />
        </label>
        <label className="text-xs font-semibold text-ink">
          Phone (optional)
          <input value={form.claimant_phone} onChange={set("claimant_phone")} className={field} />
        </label>
        <label className="text-xs font-semibold text-ink">
          Your role
          <input value={form.claimant_role} onChange={set("claimant_role")} className={field} />
        </label>
        <label className="text-xs font-semibold text-ink">
          City
          <select value={form.city} onChange={set("city")} className={field}>
            <option value="">Select a city</option>
            {ALL_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-ink">
          Business phone
          <input value={form.phone} onChange={set("phone")} className={field} />
        </label>
        <label className="text-xs font-semibold text-ink sm:col-span-2">
          Street address
          <input value={form.address} onChange={set("address")} className={field} />
        </label>
        <label className="text-xs font-semibold text-ink sm:col-span-2">
          Hours
          <input
            value={form.hours}
            onChange={set("hours")}
            placeholder="Mon-Sat 10am-9pm, Sun 11am-6pm"
            className={field}
          />
        </label>
        <label className="text-xs font-semibold text-ink sm:col-span-2">
          Website
          <input value={form.website} onChange={set("website")} className={field} />
        </label>
        <label className="text-xs font-semibold text-ink sm:col-span-2">
          Anything else
          <textarea rows={2} value={form.notes} onChange={set("notes")} className={field} />
        </label>
      </div>
      {msg && (
        <p className={`mt-3 text-xs ${msg.ok ? "text-primary" : "text-destructive"}`}>{msg.text}</p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 rounded-sm bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Sending..." : "Submit claim"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-sm border border-border px-4 text-sm font-semibold text-ink"
        >
          Close
        </button>
      </div>
    </form>
  );
}
