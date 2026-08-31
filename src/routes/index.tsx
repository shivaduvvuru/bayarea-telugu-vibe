import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Gift, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";

import towers from "@/assets/brigade-barcelona-towers.jpg.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { canonical } from "@/lib/site";

const TITLE = "Brigade Barcelona, Neopolis Hyderabad — Exclusive USA Property Showcase";
const DESC =
  "An exclusive opportunity to own a home in Hyderabad's most anticipated new launch. Brigade Barcelona pre-launch showcase touring 8 US cities with Westcliff Realty. Free EOI, by appointment only.";
const HOME_URL = canonical("/");
const OG_IMAGE = `https://bayarea-telugu-vibe.lovable.app${towers.url}`;
const PHONE = "818-272-1955";
const PHONE_TEL = "+18182721955";
const WHATSAPP =
  "https://wa.me/18182721955?text=" +
  encodeURIComponent("Hi, I'd like an appointment for the Brigade Barcelona USA showcase.");

const CITIES: { city: string; dates: string[] }[] = [
  { city: "San Francisco / Santa Clara", dates: ["21–26 Aug", "3–9 Sept", "30 Sept–7 Oct"] },
  { city: "Seattle", dates: ["27 Aug–2 Sept", "23–29 Sept"] },
  { city: "Boston", dates: ["27 Aug–2 Sept", "20–22 Sept"] },
  { city: "Charlotte", dates: ["3–9 Sept"] },
  { city: "Chicago", dates: ["17–22 Sept"] },
  { city: "New Jersey / New York", dates: ["17–19 Sept"] },
  { city: "Dallas", dates: ["10–16 Sept", "8–12 Oct"] },
  { city: "Atlanta", dates: ["10–16 Sept"] },
];

const HIGHLIGHTS = [
  { icon: Gift, text: "Early access to offers, pricing & best units*" },
  { icon: CalendarDays, text: "By appointment only, limited slots" },
  { icon: MapPin, text: "Contact us for venue & appointment details in your city" },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: HOME_URL },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [
      { rel: "canonical", href: HOME_URL },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Event",
          name: "Brigade Barcelona — Exclusive USA Property Showcase",
          description: DESC,
          url: HOME_URL,
          image: OG_IMAGE,
          eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
          startDate: "2026-08-21",
          endDate: "2026-10-12",
          organizer: { "@type": "Organization", name: "Westcliff Realty" },
          about: { "@type": "Residence", name: "Brigade Barcelona, Neopolis, Hyderabad" },
        }),
      },
    ],
  }),
  component: BrigadeBarcelonaPage,
});

const NAVY = "#0B2A5B";
const GOLD = "#C9A24A";

function BrigadeBarcelonaPage() {
  const formRef = useRef<HTMLDivElement>(null);
  const [city, setCity] = useState("");
  const [sending, setSending] = useState(false);

  function book(target: string) {
    setCity(target);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setSending(true);
    const { error } = await supabase.from("leads").insert({
      campaign: "brigade-barcelona",
      name: String(data.get("name") ?? "").trim().slice(0, 120),
      email: String(data.get("email") ?? "").trim().slice(0, 200),
      phone: String(data.get("phone") ?? "").trim().slice(0, 40) || null,
      preferred_city: String(data.get("preferred_city") ?? "") || null,
      preferred_dates: String(data.get("preferred_dates") ?? "").slice(0, 200) || null,
      message: String(data.get("message") ?? "").slice(0, 1500) || null,
      source_page: typeof window !== "undefined" ? window.location.pathname : null,
    });
    setSending(false);
    if (error) {
      toast.error("That didn't go through. Please call or WhatsApp us instead.");
      return;
    }
    toast.success("Thank you — our team will confirm your appointment shortly.");
    form.reset();
    setCity("");
  }

  const field =
    "mt-1 w-full rounded-md border border-[color:var(--bb-navy)]/20 bg-white px-3 py-2.5 text-sm text-[color:var(--bb-navy)] outline-none focus:border-[color:var(--bb-gold)]";
  const label =
    "block text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--bb-navy)]/70";

  return (
    <div
      className="bg-[#F7F7F5] pb-24 font-[Inter,ui-sans-serif] md:pb-0"
      style={{ ["--bb-navy" as string]: NAVY, ["--bb-gold" as string]: GOLD }}
    >
      {/* Header */}
      <header className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-5">
        <div className="flex min-w-0 items-center gap-4">
          <Lockup name="BRIGADE" sub="Building Positive Experiences" />
          <span className="h-10 w-px shrink-0 bg-[color:var(--bb-navy)]/15" />
          <Lockup name="WESTCLIFF" sub="Realty" gold />
        </div>
        <span
          className="shrink-0 rounded-sm bg-[color:var(--bb-navy)] px-3 py-2 text-center text-[10px] font-semibold uppercase leading-tight tracking-[0.2em] text-[color:var(--bb-gold)] sm:px-5 sm:text-xs"
          style={{ fontFamily: "Playfair Display, serif" }}
        >
          You&apos;re
          <br />
          Invited
        </span>
      </header>

      <div className="h-px w-full bg-[color:var(--bb-gold)]/40" />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-10 md:grid md:grid-cols-2 md:items-center md:gap-10 md:py-14">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--bb-gold)]">
            Pre-launching
          </p>
          <h1
            className="mt-3 text-4xl leading-[1.05] sm:text-5xl md:text-6xl"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            <span className="block font-bold text-[color:var(--bb-navy)]">BRIGADE</span>
            <span className="block font-bold text-[color:var(--bb-gold)]">BARCELONA</span>
          </h1>
          <p className="mt-4 inline-block bg-[color:var(--bb-navy)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white sm:text-sm">
            At Neopolis, Hyderabad
          </p>
          <h2
            className="mt-6 text-2xl leading-tight sm:text-3xl"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            <span className="font-bold text-[color:var(--bb-navy)]">EXCLUSIVE USA</span>{" "}
            <span className="font-bold text-[color:var(--bb-gold)]">PROPERTY SHOWCASE</span>
          </h2>
          <p className="mt-4 max-w-md text-base text-[color:var(--bb-navy)]/80">
            An exclusive opportunity to own a home in{" "}
            <strong className="font-semibold text-[color:var(--bb-navy)]">Hyderabad&apos;s</strong> most
            anticipated new launch.
          </p>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--bb-navy)]">
            Discover <span className="text-[color:var(--bb-gold)]">•</span> Invest{" "}
            <span className="text-[color:var(--bb-gold)]">•</span> Belong
          </p>

          <div className="mt-8 hidden gap-3 md:flex">
            <button
              onClick={() => book("")}
              className="rounded-full bg-[color:var(--bb-navy)] px-6 py-3 text-sm font-semibold text-white"
            >
              Book my appointment
            </button>
            <a
              href={`tel:${PHONE_TEL}`}
              className="rounded-full border border-[color:var(--bb-navy)]/25 px-6 py-3 text-sm font-semibold text-[color:var(--bb-navy)]"
            >
              Call {PHONE}
            </a>
          </div>
        </div>

        <div className="relative mt-8 md:mt-0">
          <img
            src={towers.url}
            alt="Brigade Barcelona towers at Neopolis, Hyderabad, illuminated at dusk"
            width={1536}
            height={1024}
            className="w-full rounded-lg object-cover shadow-[0_20px_60px_-30px_rgba(11,42,91,0.6)]"
          />
          <div className="absolute -bottom-6 left-4 grid h-28 w-28 place-items-center rounded-full border-2 border-[color:var(--bb-gold)] bg-white text-center shadow-lg sm:h-32 sm:w-32 md:-left-6 md:top-6 md:bottom-auto">
            <div>
              <p className="text-[10px] tracking-[0.3em] text-[color:var(--bb-gold)]">★★★</p>
              <p
                className="text-lg font-bold text-[color:var(--bb-navy)] sm:text-xl"
                style={{ fontFamily: "Playfair Display, serif" }}
              >
                FREE EOI
              </p>
              <p className="px-2 text-[10px] leading-tight text-[color:var(--bb-navy)]/70">
                No Cost • No Obligation
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="mx-auto max-w-6xl px-4 pb-4 pt-10">
        <div className="grid gap-4 sm:grid-cols-3">
          {HIGHLIGHTS.map(({ icon: Icon, text }) => (
            <div
              key={text}
              className="flex items-start gap-3 rounded-lg border border-[color:var(--bb-gold)]/30 bg-white p-5"
            >
              <Icon className="mt-0.5 h-6 w-6 shrink-0 text-[color:var(--bb-gold)]" strokeWidth={1.5} />
              <p className="min-w-0 text-sm font-medium text-[color:var(--bb-navy)]">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tour schedule */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex items-center gap-4">
          <span className="h-px flex-1 bg-[color:var(--bb-gold)]/50" />
          <h2
            className="text-center text-2xl font-bold uppercase tracking-[0.12em] text-[color:var(--bb-navy)] sm:text-3xl"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            USA Tour Schedule
          </h2>
          <span className="h-px flex-1 bg-[color:var(--bb-gold)]/50" />
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {CITIES.map((c) => (
            <div
              key={c.city}
              className="flex flex-col items-center rounded-lg border border-[color:var(--bb-navy)]/10 bg-white p-5 text-center"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full border border-[color:var(--bb-gold)]/60">
                <CalendarDays className="h-5 w-5 text-[color:var(--bb-navy)]" strokeWidth={1.5} />
              </span>
              <h3 className="mt-3 text-sm font-bold uppercase tracking-wide text-[color:var(--bb-navy)]">
                {c.city}
              </h3>
              <ul className="mt-2 space-y-0.5 text-xs text-[color:var(--bb-navy)]/70">
                {c.dates.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
              <button
                onClick={() => book(c.city)}
                className="mt-4 rounded-full border border-[color:var(--bb-navy)] px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-[color:var(--bb-navy)] hover:bg-[color:var(--bb-navy)] hover:text-white"
              >
                Book my appointment
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Contact strip */}
      <section className="bg-[color:var(--bb-navy)] py-8 text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--bb-gold)]">
            Call / WhatsApp
          </p>
          <a
            href={`tel:${PHONE_TEL}`}
            className="text-3xl font-bold sm:text-4xl"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            {PHONE}
          </a>
          <a href={WHATSAPP} className="text-sm underline decoration-[color:var(--bb-gold)]">
            Chat with us on WhatsApp
          </a>
        </div>
      </section>

      {/* Form */}
      <section ref={formRef} id="appointment" className="mx-auto max-w-3xl scroll-mt-4 px-4 py-12">
        <h2
          className="text-center text-2xl font-bold text-[color:var(--bb-navy)] sm:text-3xl"
          style={{ fontFamily: "Playfair Display, serif" }}
        >
          Book my appointment
        </h2>
        <p className="mt-2 text-center text-sm text-[color:var(--bb-navy)]/70">
          By appointment only. Limited slots available.
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-8 grid gap-4 rounded-lg border border-[color:var(--bb-gold)]/30 bg-white p-6 sm:grid-cols-2"
        >
          <label className={label}>
            Name
            <input name="name" required minLength={2} maxLength={120} className={field} />
          </label>
          <label className={label}>
            Email
            <input name="email" type="email" required maxLength={200} className={field} />
          </label>
          <label className={label}>
            Phone
            <input name="phone" maxLength={40} className={field} />
          </label>
          <label className={label}>
            Preferred city
            <select
              name="preferred_city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={field}
            >
              <option value="">Select a city</option>
              {CITIES.map((c) => (
                <option key={c.city} value={c.city}>
                  {c.city}
                </option>
              ))}
            </select>
          </label>
          <label className={`${label} sm:col-span-2`}>
            Preferred dates
            <input
              name="preferred_dates"
              maxLength={200}
              placeholder="e.g. 3–9 Sept, weekend preferred"
              className={field}
            />
          </label>
          <label className={`${label} sm:col-span-2`}>
            Message
            <textarea name="message" rows={4} maxLength={1500} className={field} />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={sending}
              className="w-full rounded-full bg-[color:var(--bb-navy)] px-6 py-3 text-sm font-bold text-white disabled:opacity-60 sm:w-auto"
            >
              {sending ? "Sending…" : "Request my appointment"}
            </button>
          </div>
        </form>
      </section>

      {/* Footer */}
      <footer className="border-t border-[color:var(--bb-gold)]/40 bg-white px-4 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 text-center">
          <div className="flex items-center gap-5">
            <Lockup name="BRIGADE" sub="Building Positive Experiences" />
            <span className="h-10 w-px bg-[color:var(--bb-navy)]/15" />
            <Lockup name="WESTCLIFF" sub="Realty" gold />
          </div>
          <p className="text-xs text-[color:var(--bb-navy)]/60">*Terms &amp; conditions apply</p>
          <p className="text-xs text-[color:var(--bb-navy)]/60">
            © {new Date().getFullYear()} Westcliff Realty. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Sticky mobile CTAs */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-[color:var(--bb-gold)]/40 bg-white p-3 md:hidden">
        <button
          onClick={() => book(city)}
          className="flex-1 rounded-full bg-[color:var(--bb-navy)] px-4 py-3 text-sm font-bold text-white"
        >
          Book my appointment
        </button>
        <a
          href={`tel:${PHONE_TEL}`}
          aria-label={`Call ${PHONE}`}
          className="grid w-12 shrink-0 place-items-center rounded-full bg-[color:var(--bb-gold)] text-white"
        >
          <Phone className="h-5 w-5" />
        </a>
      </div>
    </div>
  );
}

/** Text lockup standing in for each partner logo until artwork is supplied. */
function Lockup({ name, sub, gold }: { name: string; sub: string; gold?: boolean }) {
  return (
    <span className="min-w-0">
      <span
        className={`block text-lg font-bold tracking-[0.18em] sm:text-xl ${
          gold ? "text-[color:var(--bb-gold)]" : "text-[color:var(--bb-navy)]"
        }`}
        style={{ fontFamily: "Playfair Display, serif" }}
      >
        {name}
      </span>
      <span className="block truncate text-[9px] uppercase tracking-[0.16em] text-[color:var(--bb-navy)]/60">
        {sub}
      </span>
    </span>
  );
}
