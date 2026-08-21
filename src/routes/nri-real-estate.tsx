import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Handshake,
  Landmark,
  MapPin,
  MessageCircle,
  Ruler,
  Scale,
  ShieldCheck,
  TrendingUp,
  X,
} from "lucide-react";
import { submitPropertyEnquiry } from "@/lib/property.functions";
import { PROPERTY_FEATURES, propertyImage } from "@/lib/property-showcase";
import {
  BAY_AREA_CITIES,
  BUDGET_RANGES,
  CONCIERGE_WHATSAPP,
  MICRO_MARKETS,
  NRI_FILTERS,
  PARTNERS,
  TRUST_POINTS,
  luxuryProperties,
  whatsappLink,
  type NriFilterKey,
  type PropertyItem,
} from "@/data/nriProperties";
import { canonical } from "@/lib/site";
import { cn } from "@/lib/utils";

const TITLE = "CREDAI Elite NRI Real Estate Showcase | Times Bay Area";
const DESC =
  "Curated CREDAI-verified luxury villas, sky mansions and managed farm estates in Hyderabad and Amaravati for Bay Area NRI investors — RERA-clear titles, yields and full concierge support.";
const URL = canonical("/nri-real-estate");
const HERO_IMAGE = propertyImage("3-1");
const CAMPAIGN = "credai-hyderabad-2026";

export const Route = createFileRoute("/nri-real-estate")({
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
  component: NriRealEstatePage,
});

/* ------------------------------------------------------------------ hero --- */

interface HeroSlide {
  id: string;
  kicker: string;
  title: string;
  location: string;
  configuration: string;
  yield: string;
  rera: string;
  image: string;
  site?: string | undefined;
}

const heroSlides: HeroSlide[] = [
  {
    id: "credai-featured",
    kicker: "Featured showcase",
    title: "CREDAI Hyderabad Property Show 2026",
    location: "HITEX Hyderabad · Aug 28–30, 2026",
    configuration: "Villas, sky mansions & managed estates under one roof",
    yield: "NRI buying desk with verified CREDAI builders",
    rera: "All participating projects RERA registered",
    image: propertyImage("3-1"),
  },
  ...PROPERTY_FEATURES.slice(0, 10).map((p) => ({
    id: p.id,
    kicker: p.developer,
    title: p.project,
    location: p.location ?? "Hyderabad",
    configuration: p.note ?? "Premium high-rise residences",
    yield: "Projected 9–12% annualized yield",
    rera: "RERA registered · title verified",
    image: propertyImage(p.id),
    site: p.site,
  })),
];

const HERO_ROTATE_MS = 12_000;

function HeroCarousel({ onEnquire }: { onEnquire: () => void }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(
      () => setI((n) => (n + 1) % heroSlides.length),
      HERO_ROTATE_MS,
    );
    return () => window.clearInterval(id);
  }, [paused]);

  const slide = heroSlides[i % heroSlides.length]!;
  const go = (d: number) => {
    setPaused(true);
    setI((n) => (n + d + heroSlides.length) % heroSlides.length);
  };

  return (
    <section aria-label="Featured luxury projects" className="mt-6">
      <div className="grid gap-6 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:items-center">
        <div className="relative overflow-hidden rounded-2xl border border-primary/40 bg-card shadow-2xl">
          <img
            key={slide.image}
            src={slide.image}
            alt={`${slide.title} — ${slide.kicker}`}
            loading="eager"
            className="mx-auto max-h-[62vh] w-full animate-in fade-in duration-700 object-contain"
          />
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary-foreground">
            <Building2 className="h-3 w-3" aria-hidden />
            CREDAI showcase
          </span>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
            {slide.kicker}
          </p>
          <h2 className="mt-2 text-2xl font-bold leading-tight text-foreground sm:text-3xl">
            {slide.title}
          </h2>
          <dl className="mt-4 space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <dd>{slide.location}</dd>
            </div>
            <div className="flex items-start gap-2">
              <Ruler className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <dd>{slide.configuration}</dd>
            </div>
            <div className="flex items-start gap-2">
              <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <dd>{slide.yield}</dd>
            </div>
            <div className="flex items-start gap-2">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <dd>{slide.rera}</dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onEnquire}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground hover:opacity-90"
            >
              Schedule 3D tour
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onEnquire}
              className="inline-flex min-h-11 items-center rounded-full border border-primary/50 px-5 text-sm font-semibold text-foreground hover:bg-primary/10"
            >
              Download due-diligence deck
            </button>
          </div>

          <div className="mt-5 flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous project"
              onClick={() => go(-1)}
              className="grid h-9 w-9 place-items-center rounded-full border border-border text-foreground hover:border-primary"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Next project"
              onClick={() => go(1)}
              className="grid h-9 w-9 place-items-center rounded-full border border-border text-foreground hover:border-primary"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
            <span className="text-xs text-muted-foreground">
              {i + 1} / {heroSlides.length}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- listings --- */

function PropertyTile({ item }: { item: PropertyItem }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="relative bg-muted">
        <img
          src={item.image}
          alt={`${item.title} by ${item.developer}`}
          loading="lazy"
          className="aspect-[4/3] w-full object-cover object-top"
        />
        <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-primary-foreground">
          {item.badge ?? (item.reraApproved ? "CREDAI verified" : "Featured")}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
          {item.developer}
        </p>
        <h3 className="text-[15px] font-bold leading-snug text-foreground">{item.title}</h3>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {item.location}
        </p>
        <p className="mt-1 text-sm font-bold text-foreground">{item.priceINR}</p>
        <p className="text-xs text-muted-foreground">{item.priceUSD}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Ruler className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {item.sqft}
        </p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Possession {item.possession}
        </p>
        <p className="flex items-center gap-1 text-xs font-semibold text-primary">
          <TrendingUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {item.roiEstimate}
        </p>
        <div className="mt-auto flex flex-wrap gap-2 pt-3">
          <a
            href={item.virtualTourUrl ?? "#nri-concierge"}
            className="inline-flex min-h-9 items-center rounded-full border border-primary/50 px-3 text-xs font-semibold text-foreground hover:bg-primary/10"
          >
            View 3D walkthrough
          </a>
          <a
            href={whatsappLink(
              `Hello NRI Desk — I'd like details on ${item.title} (${item.location}).`,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 items-center gap-1 rounded-full bg-primary px-3 text-xs font-bold text-primary-foreground hover:opacity-90"
          >
            <MessageCircle className="h-3.5 w-3.5" aria-hidden />
            Inquire on WhatsApp
          </a>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------- form --- */

function ConciergeForm({ compact }: { compact?: boolean }) {
  const submit = useServerFn(submitPropertyEnquiry);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const el = e.currentTarget;
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
        message: `NRI showcase · preferred micro-market: ${String(form.get("market") ?? "n/a")}`,
        sourcePage: "/nri-real-estate",
      },
    }).catch(() => ({ ok: false as const, projects: [] as string[] }));

    if (res.ok) {
      setState("done");
      el.reset();
    } else setState("error");
  }

  if (state === "done")
    return (
      <div className="rounded-xl border border-primary/40 bg-card p-5 text-center">
        <ShieldCheck className="mx-auto h-8 w-8 text-primary" aria-hidden />
        <h3 className="mt-2 text-lg font-bold text-foreground">Request received</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Our NRI desk will share the confidential due-diligence package shortly.
        </p>
        <a
          href={whatsappLink("Hello NRI Desk — I just submitted the concierge form.")}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          Chat with the desk now
        </a>
      </div>
    );

  const field =
    "min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none";

  return (
    <form onSubmit={onSubmit} className={cn("grid gap-3", compact ? "" : "sm:grid-cols-2")}>
      <input name="name" required minLength={2} maxLength={80} placeholder="Full name" className={field} />
      <input
        name="email"
        type="email"
        required
        maxLength={160}
        placeholder="Email address"
        className={field}
      />
      <input
        name="phone"
        type="tel"
        maxLength={40}
        placeholder="US phone / WhatsApp number"
        className={field}
      />
      <select name="city" defaultValue="" className={field} aria-label="Your city">
        <option value="">Your city</option>
        {BAY_AREA_CITIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <select name="budget" defaultValue="" className={field} aria-label="Investment budget">
        <option value="">Investment budget</option>
        {BUDGET_RANGES.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>
      <select name="market" defaultValue="" className={field} aria-label="Preferred micro-market">
        <option value="">Preferred micro-market</option>
        {MICRO_MARKETS.map((m) => (
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
          {state === "sending" ? "Sending…" : "Request concierge consultation"}
        </button>
        {state === "error" ? (
          <p className="mt-2 text-xs text-destructive">
            Could not send just now — please try again or message the desk on WhatsApp.
          </p>
        ) : null}
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------- page --- */

const TRUST_ICONS = [ShieldCheck, TrendingUp, Handshake, Scale];

function NriRealEstatePage() {
  const [filter, setFilter] = useState<NriFilterKey>("all");
  const [modal, setModal] = useState(false);

  const items = useMemo(
    () => (filter === "all" ? luxuryProperties : luxuryProperties.filter((p) => p.type === filter)),
    [filter],
  );

  return (
    <div className="luxedesk min-h-screen">
      <div className="border-b border-primary/30 bg-primary/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5">
          <p className="text-xs font-semibold text-foreground">
            Exclusive CREDAI NRI Property Showcase — guaranteed title clarity &amp; high rental
            yields
          </p>
          <button
            type="button"
            onClick={() => setModal(true)}
            className="inline-flex min-h-9 items-center rounded-full bg-primary px-3.5 text-xs font-bold text-primary-foreground"
          >
            Book concierge consultation
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        <header>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
            Telugu Times × TimesBayArea × CREDAI
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-tight text-foreground sm:text-4xl">
            CREDAI Elite NRI Real Estate Showcase
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Ultra-luxury villas, high-rise sky mansions and managed farm estates in Hyderabad and
            Amaravati — curated for Bay Area investors with RERA-clear titles, verified builders and
            end-to-end concierge support.
          </p>
        </header>

        <HeroCarousel onEnquire={() => setModal(true)} />

        <section className="mt-10" aria-label="Why invest with CREDAI assurance">
          <h2 className="text-xl font-bold text-foreground">Why invest with CREDAI assurance</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST_POINTS.map((point, idx) => {
              const Icon = TRUST_ICONS[idx] ?? ShieldCheck;
              return (
                <div key={point.title} className="rounded-xl border border-border bg-card p-4">
                  <Icon className="h-6 w-6 text-primary" aria-hidden />
                  <h3 className="mt-3 text-[15px] font-bold text-foreground">{point.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{point.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-10" aria-label="Curated luxury properties">
          <h2 className="text-xl font-bold text-foreground">Curated luxury inventory</h2>
          <div className="mt-3 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {NRI_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "min-h-9 shrink-0 rounded-full border px-3.5 text-xs font-semibold",
                  filter === f.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-foreground hover:border-primary",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <PropertyTile key={item.id} item={item} />
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Prices, yields and possession dates are indicative and provided by the developers.
            Verify RERA registration and title documents before any commitment.
          </p>
        </section>

        <section id="nri-concierge" className="mt-10 scroll-mt-20">
          <div className="rounded-2xl border border-primary/40 bg-card p-5 sm:p-6">
            <h2 className="text-xl font-bold text-foreground">
              NRI concierge &amp; due-diligence request
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Share a few details and our cross-border desk will send the confidential project
              package, RERA documents and a private 3D tour slot.
            </p>
            <div className="mt-4">
              <ConciergeForm />
            </div>
          </div>
        </section>

        <section className="mt-10" aria-label="Association and media partners">
          <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-primary">
            In association with
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {PARTNERS.map((p) => (
              <li
                key={p}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground"
              >
                <Landmark className="h-3.5 w-3.5 text-primary" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <a
        href={whatsappLink("Hello NRI Desk — I'd like help with Hyderabad property investment.")}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="WhatsApp concierge"
        className="fixed bottom-20 right-4 z-40 inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground shadow-2xl md:bottom-6"
      >
        <MessageCircle className="h-5 w-5" aria-hidden />
        NRI Desk
      </a>

      {modal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Book concierge consultation"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center"
          onClick={() => setModal(false)}
        >
          <div
            className="luxedesk w-full max-w-lg rounded-2xl border border-primary/40 bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold text-foreground">Book concierge consultation</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setModal(false)}
                className="grid h-9 w-9 place-items-center rounded-full border border-border text-foreground"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              WhatsApp desk: +{CONCIERGE_WHATSAPP.slice(0, 1)} ({CONCIERGE_WHATSAPP.slice(1, 4)}){" "}
              {CONCIERGE_WHATSAPP.slice(4, 7)}-{CONCIERGE_WHATSAPP.slice(7)}
            </p>
            <div className="mt-4">
              <ConciergeForm compact />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
