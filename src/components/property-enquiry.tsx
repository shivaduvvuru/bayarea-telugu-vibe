import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { submitPropertyEnquiry } from "@/lib/property.functions";
import { BUDGET_BANDS, type Property } from "@/lib/property";
import { cn } from "@/lib/utils";

/**
 * One enquiry form for one or many shortlisted projects. Leads are stored
 * server-side with campaign attribution so Telugu Times can report interest
 * back to CREDAI and to each developer.
 */
export function PropertyEnquiry({
  campaignSlug,
  selected,
  onClear,
  className,
}: {
  campaignSlug: string;
  selected: Property[];
  onClear?: () => void;
  className?: string;
}) {
  const submit = useServerFn(submitPropertyEnquiry);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setState("sending");
    const utm: Record<string, string> = {};
    if (typeof window !== "undefined") {
      new URLSearchParams(window.location.search).forEach((v, k) => {
        if (k.startsWith("utm_")) utm[k] = v.slice(0, 120);
      });
    }
    const res = await submit({
      data: {
        campaignSlug,
        propertyIds: selected.map((p) => p.id),
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? "") || undefined,
        country: String(form.get("country") ?? "") || undefined,
        city: String(form.get("city") ?? "") || undefined,
        preferredContact:
          (String(form.get("preferredContact") ?? "email") as "email" | "phone" | "whatsapp") ||
          undefined,
        budget: String(form.get("budget") ?? "") || undefined,
        message: String(form.get("message") ?? "") || undefined,
        sourcePage: typeof window !== "undefined" ? window.location.pathname : undefined,
        referrer: typeof document !== "undefined" ? document.referrer.slice(0, 300) : undefined,
        utm,
      },
    }).catch(() => ({ ok: false as const, projects: [] as string[] }));

    if (res.ok) {
      setState("done");
      onClear?.();
      e.currentTarget.reset();
    } else {
      setState("error");
    }
  }

  const field =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-primary";

  return (
    <section
      id="enquire"
      className={cn("rounded-lg border border-border bg-card p-4", className)}
    >
      <h2 className="text-lg font-bold text-ink">Request project details</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Your enquiry goes to Telugu Times, which passes it to the developer. Nothing is shared
        beyond the projects you select.
      </p>

      {selected.length > 0 ? (
        <div className="mt-3 rounded-md bg-surface-tint p-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
            Shortlisted ({selected.length})
          </p>
          <p className="mt-1 text-xs text-ink">
            {selected.map((p) => `${p.project_name} — ${p.developer}`).join("; ")}
          </p>
        </div>
      ) : null}

      {state === "done" ? (
        <p className="mt-4 rounded-md border border-primary/40 bg-primary/10 p-3 text-sm font-semibold text-ink">
          Thank you — your enquiry is recorded. The Telugu Times property desk will follow up.
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-muted-foreground">
          Name
          <input name="name" required minLength={2} maxLength={80} className={cn(field, "mt-1")} />
        </label>
        <label className="text-xs font-semibold text-muted-foreground">
          Email
          <input name="email" type="email" required className={cn(field, "mt-1")} />
        </label>
        <label className="text-xs font-semibold text-muted-foreground">
          Phone / WhatsApp
          <input name="phone" maxLength={40} className={cn(field, "mt-1")} />
        </label>
        <label className="text-xs font-semibold text-muted-foreground">
          Country
          <select name="country" defaultValue="United States" className={cn(field, "mt-1")}>
            <option>United States</option>
            <option>India</option>
            <option>Canada</option>
            <option>United Kingdom</option>
            <option>Australia</option>
            <option>Other</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-muted-foreground">
          City
          <input name="city" maxLength={60} className={cn(field, "mt-1")} />
        </label>
        <label className="text-xs font-semibold text-muted-foreground">
          Budget
          <select name="budget" defaultValue="" className={cn(field, "mt-1")}>
            <option value="">Not sure yet</option>
            {BUDGET_BANDS.map((b) => (
              <option key={b.key} value={b.label}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted-foreground">
          Preferred contact
          <select name="preferredContact" defaultValue="email" className={cn(field, "mt-1")}>
            <option value="email">Email</option>
            <option value="phone">Phone call</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-muted-foreground sm:col-span-2">
          What are you looking for?
          <textarea name="message" rows={3} maxLength={1200} className={cn(field, "mt-1")} />
        </label>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={state === "sending"}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {state === "sending" ? "Sending…" : "Send enquiry"}
          </button>
          {state === "error" ? (
            <p className="mt-2 text-xs font-semibold text-destructive">
              That didn&apos;t go through. Please check your details and try again.
            </p>
          ) : null}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Telugu Times is a media partner, not a broker or agent. Verify all project details,
            approvals and pricing directly with the developer before making any payment.
          </p>
        </div>
      </form>
    </section>
  );
}
