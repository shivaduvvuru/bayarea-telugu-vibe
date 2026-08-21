import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  FileCheck2,
  Handshake,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Video,
  X,
} from "lucide-react";
import { submitPropertyEnquiry } from "@/lib/property.functions";
import {
  BUDGETS,
  MICRO_MARKET_TABS,
  NRI_DESK_NAME,
  PROXY_SERVICES,
  SHOW_BADGES,
  SHOW_START_ISO,
  SHOW_TAGLINE,
  SHOW_VENUE,
  TARGET_MARKETS,
  US_CITIES,
  credaiShowProjects,
  deskWhatsappLink,
  showcaseSlides,
  type CredaiProject,
  type MicroMarketKey,
} from "@/data/credaiShowData";
import { canonical } from "@/lib/site";
import { cn } from "@/lib/utils";

const TITLE = "CREDAI Hyderabad Property Show 2026 — NRI Expo Hub | Times Bay Area";
const DESC =
  "CREDAI Hyderabad Property Show, Aug 28–30 2026 at HITEX. Virtual NRI showcase: 300+ RERA-approved projects, 70+ Grade-A builders, dual-currency pricing and a Bay Area concierge desk.";
const URL = canonical("/credai-show");
const HERO_IMAGE = showcaseSlides[0]!.imageUrl;
const CAMPAIGN = "credai-hyderabad-2026";

export const Route = createFileRoute("/credai-show")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { property: "og:image", content: HERO_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: HERO_IMAGE },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: CredaiShowPage,
});

const GLASS = "border border-primary/25 bg-card/70 backdrop-blur-xl";

/* -------------------------------------------------------------- countdown --- */

function Countdown() {
  const target = new Date(SHOW_START_ISO).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (now == null) return null;
  const diff = Math.max(0, target - now);
  if (diff === 0)
    return <span className="text-xs font-bold text-primary">Show is live at HITEX</span>;

  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);

  return (
    <span className="flex items-center gap-1.5 text-xs font-bold tabular-nums text-primary">
      {[
        { v: d, l: "d" },
        { v: h, l: "h" },
        { v: m, l: "m" },
        { v: s, l: "s" },
      ].map((u) => (
        <span key={u.l} className="rounded-md bg-primary/15 px-1.5 py-0.5">
          {String(u.v).padStart(2, "0")}
          <span className="text-[10px] font-medium text-muted-foreground">{u.l}</span>
        </span>
      ))}
    </span>
  );
}

/* ----------------------------------------------------------------- hero ----- */

const SLIDE_MS = 6000;

function HeroCarousel({ onRegister }: { onRegister: () => void }) {
  const total = showcaseSlides.length + 1;
  const [i, setI] = useState(0);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    if (hover) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % total), SLIDE_MS);
    return () => window.clearInterval(id);
  }, [hover, total]);

  const slide = i === 0 ? null : showcaseSlides[(i - 1) % showcaseSlides.length]!;

  return (
    <section
      aria-label="CREDAI show highlights"
      className="mt-6"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:items-center">
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl p-2 shadow-2xl",
            GLASS,
            "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_50%_0%,color-mix(in_oklab,var(--primary)_28%,transparent),transparent_65%)]",
          )}
        >
          <img
            key={slide ? slide.imageUrl : "official"}
            src={slide ? slide.imageUrl : HERO_IMAGE}
            alt={
              slide
                ? `${slide.project} by ${slide.developer}`
                : "CREDAI Hyderabad Property Show 2026 featured project"
            }
            loading="eager"
            className="relative mx-auto max-h-[62vh] w-full rounded-xl object-contain animate-in fade-in duration-700"
          />
        </div>

        <div>
          {slide ? (
            <>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
                {slide.developer}
              </p>
              <h2 className="mt-2 text-2xl font-bold leading-tight text-foreground sm:text-3xl">
                {slide.project}
              </h2>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  {slide.location}
                </li>
                <li className="flex items-start gap-2">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  {slide.yieldNote}
                </li>
                <li className="flex items-start gap-2">
                  <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  Possession {slide.possession}
                </li>
              </ul>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onRegister}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground hover:opacity-90"
                >
                  Request project deck
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
                <a
                  href={deskWhatsappLink(
                    `Hello ${NRI_DESK_NAME}, I'd like details on ${slide.project} at the CREDAI Aug 28-30 show.`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary/50 px-5 text-sm font-semibold text-foreground hover:bg-primary/10"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden />
                  WhatsApp inquiry
                </a>
              </div>
            </>
          ) : (
            <>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
                Official show slide · {SHOW_TAGLINE}
              </p>
              <h2 className="mt-2 text-2xl font-bold leading-tight text-foreground sm:text-3xl">
                CREDAI Hyderabad Property Show 2026
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                August 28–30, 2026 · {SHOW_VENUE}
              </p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {SHOW_BADGES.map((b) => (
                  <li
                    key={b}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold text-foreground",
                      GLASS,
                    )}
                  >
                    {b}
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onRegister}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground hover:opacity-90"
                >
                  Download show directory
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
                <a
                  href={deskWhatsappLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary/50 px-5 text-sm font-semibold text-foreground hover:bg-primary/10"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden />
                  Chat with {NRI_DESK_NAME}
                </a>
              </div>
            </>
          )}

          <div className="mt-6 flex items-center gap-2">
            {Array.from({ length: total }).map((_, n) => (
              <button
                key={n}
                type="button"
                aria-label={`Go to slide ${n + 1}`}
                aria-current={n === i}
                onClick={() => setI(n)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  n === i ? "w-8 bg-primary" : "w-3 bg-border hover:bg-primary/50",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- project card -- */

function ProjectCard({ item, onDeck }: { item: CredaiProject; onDeck: () => void }) {
  return (
    <article className={cn("flex flex-col overflow-hidden rounded-xl", GLASS)}>
      <div className="relative bg-muted">
        <img
          src={item.imageUrl}
          alt={`${item.name} by ${item.developer}`}
          loading="lazy"
          className="aspect-[4/3] w-full object-cover object-top"
        />
        <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-primary-foreground">
          RERA {item.reraNumber}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
          {item.developer} · {item.type}
        </p>
        <h3 className="text-[15px] font-bold leading-snug text-foreground">{item.name}</h3>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {item.location}
        </p>
        <p className="mt-1 text-sm font-bold text-foreground">{item.priceINR}</p>
        <p className="text-xs text-muted-foreground">{item.priceUSD}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Possession {item.possession}
        </p>
        <ul className="mt-1 space-y-0.5">
          {item.highlights.map((h) => (
            <li key={h} className="flex items-start gap-1 text-xs text-muted-foreground">
              <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              {h}
            </li>
          ))}
        </ul>
        <div className="mt-auto flex flex-wrap gap-2 pt-3">
          <button
            type="button"
            onClick={onDeck}
            className="inline-flex min-h-9 items-center rounded-full border border-primary/50 px-3 text-xs font-semibold text-foreground hover:bg-primary/10"
          >
            Request due-diligence deck
          </button>
          <a
            href={deskWhatsappLink(
              `Hello ${NRI_DESK_NAME}, I'd like details on ${item.name} (${item.location}).`,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 items-center gap-1 rounded-full bg-primary px-3 text-xs font-bold text-primary-foreground hover:opacity-90"
          >
            <MessageCircle className="h-3.5 w-3.5" aria-hidden />
            WhatsApp inquiry
          </a>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------- form --- */

function LeadForm({ compact }: { compact?: boolean }) {
  const submit = useServerFn(submitPropertyEnquiry);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const el = e.currentTarget;
    const form = new FormData(el);
    setState("sending");
    const res = await submit({
      data: {
        campaignSlug: CAMPAIGN,
        propertyIds: [],
        name: String(form.get("name") ?? "").trim(),
        email: String(form.get("email") ?? "").trim(),
        phone: String(form.get("phone") ?? "").trim() || undefined,
        country: "United States",
        city: String(form.get("city") ?? "") || undefined,
        preferredContact: "whatsapp" as const,
        budget: String(form.get("budget") ?? "") || undefined,
        message: `CREDAI show hub · target micro-market: ${String(form.get("market") ?? "n/a")}`,
        sourcePage: "/credai-show",
      },
    }).catch(() => ({ ok: false as const, projects: [] as string[] }));

    if (res.ok) {
      setState("done");
      el.reset();
    } else setState("error");
  }

  if (state === "done")
    return (
      <div className={cn("rounded-xl p-5 text-center", GLASS)}>
        <ShieldCheck className="mx-auto h-8 w-8 text-primary" aria-hidden />
        <h3 className="mt-2 text-lg font-bold text-foreground">You&apos;re on the list</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          The virtual floor deck and project shortlist are on the way.
        </p>
        <a
          href={deskWhatsappLink()}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          Open WhatsApp chat with {NRI_DESK_NAME}
        </a>
      </div>
    );

  const field =
    "min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none";

  return (
    <form onSubmit={onSubmit} className={cn("grid gap-3", compact ? "" : "sm:grid-cols-2")}>
      <input name="name" required minLength={2} maxLength={80} placeholder="Full name" className={field} />
      <input
        name="phone"
        type="tel"
        maxLength={40}
        placeholder="US / WhatsApp phone number"
        className={field}
      />
      <input
        name="email"
        type="email"
        required
        maxLength={160}
        placeholder="Email address"
        className={field}
      />
      <select name="city" defaultValue="" className={field} aria-label="US city">
        <option value="">US city</option>
        {US_CITIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <select name="budget" defaultValue="" className={field} aria-label="Target investment budget">
        <option value="">Target investment budget</option>
        {BUDGETS.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>
      <select name="market" defaultValue="" className={field} aria-label="Preferred micro-market">
        <option value="">Preferred micro-market</option>
        {TARGET_MARKETS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <div className={compact ? "" : "sm:col-span-2"}>
        <button
          type="submit"
          disabled={state === "sending"}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {state === "sending" ? "Sending…" : "Register for virtual floor deck"}
        </button>
        {state === "error" ? (
          <p className="mt-2 text-xs text-destructive">
            Could not send just now — please retry or message the desk on WhatsApp.
          </p>
        ) : null}
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------- page --- */

const PROXY_ICONS = [Video, FileCheck2, Handshake];

function CredaiShowPage() {
  const [tab, setTab] = useState<MicroMarketKey>("all");
  const [modal, setModal] = useState(false);

  const items = useMemo(
    () => (tab === "all" ? credaiShowProjects : credaiShowProjects.filter((p) => p.market === tab)),
    [tab],
  );

  return (
    <div className="luxedesk min-h-screen">
      <div className="border-b border-primary/30 bg-primary/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5">
          <p className="text-xs font-semibold text-foreground">
            <span className="text-destructive">●</span> CREDAI Hyderabad Property Show 2026 (Aug
            28–30 @ HITEX) — live NRI virtual showcase
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Countdown />
            <button
              type="button"
              onClick={() => setModal(true)}
              className="inline-flex min-h-9 items-center rounded-full bg-primary px-3.5 text-xs font-bold text-primary-foreground"
            >
              Register for virtual floor deck
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        <header>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
            {SHOW_TAGLINE} · Official CREDAI Hyderabad Property Show 2026
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-tight text-foreground sm:text-4xl">
            Hyderabad&apos;s biggest property show, from your living room in the US
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            300+ RERA-approved projects and 70+ Grade-A builders at HITEX, August 28–30, 2026 —
            covered for NRIs by Telugu Times and TimesBayArea with a dedicated buying desk.
          </p>
        </header>

        <HeroCarousel onRegister={() => setModal(true)} />

        <section className="mt-10" aria-label="NRI proxy concierge">
          <h2 className="text-xl font-bold text-foreground">
            Can&apos;t travel to Hyderabad? Use our NRI proxy concierge
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {PROXY_SERVICES.map((s, idx) => {
              const Icon = PROXY_ICONS[idx] ?? Video;
              return (
                <div key={s.title} className={cn("rounded-xl p-4", GLASS)}>
                  <Icon className="h-6 w-6 text-primary" aria-hidden />
                  <h3 className="mt-3 text-[15px] font-bold text-foreground">{s.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{s.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-10" aria-label="Micro-market investment showcase">
          <h2 className="text-xl font-bold text-foreground">
            Curated micro-market investment showcase
          </h2>
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
            {MICRO_MARKET_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "min-h-9 shrink-0 rounded-full border px-3.5 text-xs font-semibold",
                  tab === t.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-foreground hover:border-primary",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <ProjectCard key={item.id} item={item} onDeck={() => setModal(true)} />
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Prices, yields, possession dates and RERA numbers are indicative show data supplied by
            participating developers. Verify all documents before any commitment.
          </p>
        </section>

        <section id="credai-register" className="mt-10 scroll-mt-20">
          <div className={cn("rounded-2xl p-5 sm:p-6", GLASS)}>
            <h2 className="text-xl font-bold text-foreground">
              Register for the virtual floor deck
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Get the HITEX floor directory, shortlisted NRI-friendly projects and a private
              walkthrough slot with {NRI_DESK_NAME}.
            </p>
            <div className="mt-4">
              <LeadForm />
            </div>
          </div>
        </section>
      </div>

      <a
        href={deskWhatsappLink()}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-20 right-4 z-40 inline-flex min-h-12 max-w-[15rem] items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold leading-tight text-primary-foreground shadow-2xl md:bottom-6 md:text-sm"
      >
        <MessageCircle className="h-5 w-5 shrink-0" aria-hidden />
        Chat with {NRI_DESK_NAME} (NRI Property Desk)
      </a>

      {modal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Register for the virtual floor deck"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center"
          onClick={() => setModal(false)}
        >
          <div
            className={cn("luxedesk w-full max-w-lg rounded-2xl p-5", GLASS)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold text-foreground">
                Register for the virtual floor deck
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setModal(false)}
                className="grid h-9 w-9 place-items-center rounded-full border border-border text-foreground"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="mt-4">
              <LeadForm compact />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
