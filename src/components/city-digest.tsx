import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { subscribeToCityDigest } from "@/lib/digest.functions";

/** Weekly per-city roundup sign-up. */
export function CityDigestSignup({ city }: { city: string }) {
  const send = useServerFn(subscribeToCityDigest);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await send({ data: { email, city } });
      setMsg({ ok: true, text: `You're on the ${city} list. The roundup goes out weekly.` });
      setEmail("");
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-10 rounded-sm border border-border bg-surface-tint p-5">
      <h2 className="text-lg font-bold text-ink">Get the {city} weekly roundup</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Local news, upcoming events and temple announcements for {city} — one email a week.
      </p>
      <form onSubmit={submit} className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="sr-only" htmlFor={`digest-${city}`}>
          Email address
        </label>
        <input
          id={`digest-${city}`}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="min-h-11 w-full rounded-sm border border-border bg-background px-3 text-base text-ink"
        />
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 shrink-0 rounded-sm bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Subscribing…" : "Subscribe"}
        </button>
      </form>
      {msg && (
        <p className={`mt-2 text-xs ${msg.ok ? "text-primary" : "text-destructive"}`}>{msg.text}</p>
      )}
    </section>
  );
}