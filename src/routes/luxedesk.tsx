import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  BadgeCheck,
  Check,
  Crown,
  Flag,
  Gem,
  MapPin,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import {
  MEMBER_PROFILES,
  type MemberProfile,
  type ReviewStatus,
  type VerificationTier,
} from "@/lib/luxedesk-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/luxedesk")({
  head: () => ({
    meta: [
      { title: "LuxeDesk — Applicant & Member Review Desk" },
      {
        name: "description",
        content:
          "Moderation console for reviewing, verifying and approving luxury member applications with tier badges, notes and audit metadata.",
      },
      { property: "og:title", content: "LuxeDesk — Member Review Desk" },
      {
        property: "og:description",
        content:
          "Review member applications, verify identity tiers and record moderation notes in one dark-luxury console.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LuxeDeskPage,
});

const STATUS_STYLES: Record<ReviewStatus, string> = {
  Pending: "border-primary/40 bg-primary/10 text-primary",
  Approved: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  Rejected: "border-destructive/40 bg-destructive/15 text-destructive",
  Flagged: "border-amber-400/40 bg-amber-400/10 text-amber-300",
};

const TIER_ICON: Record<VerificationTier, typeof Crown> = {
  Standard: Sparkles,
  "VIP Gold": Crown,
  "VIP Platinum": Gem,
};

function StatusBadge({ status }: { status: ReviewStatus }) {
  return (
    <Badge variant="outline" className={cn("rounded-full text-[11px]", STATUS_STYLES[status])}>
      {status}
    </Badge>
  );
}

function TierBadge({ tier }: { tier: VerificationTier }) {
  const Icon = TIER_ICON[tier];
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/35 bg-primary/10 px-2 py-0.5 text-[11px] font-medium tracking-wide text-primary">
      <Icon className="size-3" aria-hidden="true" />
      {tier}
    </span>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Users;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
      <Icon className="size-4 text-primary" aria-hidden="true" />
      <div className="leading-tight">
        <p className="text-sm font-semibold text-card-foreground">{value}</p>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function LuxeDeskPage() {
  const [profiles, setProfiles] = useState<MemberProfile[]>(MEMBER_PROFILES);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | ReviewStatus>("all");
  const [tier, setTier] = useState<"all" | VerificationTier>("all");
  const [activeId, setActiveId] = useState(MEMBER_PROFILES[0]!.id);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const metrics = useMemo(
    () => ({
      total: profiles.length,
      pending: profiles.filter((p) => p.review_status === "Pending").length,
      approved: profiles.filter((p) => p.review_status === "Approved").length,
      flagged: profiles.filter((p) => p.review_status === "Flagged").length,
    }),
    [profiles],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return profiles.filter((p) => {
      if (status !== "all" && p.review_status !== status) return false;
      if (tier !== "all" && p.verification_tier !== tier) return false;
      if (!q) return true;
      return [p.name, p.occupation, p.location].some((f) => f.toLowerCase().includes(q));
    });
  }, [profiles, query, status, tier]);

  const active = profiles.find((p) => p.id === activeId) ?? filtered[0] ?? profiles[0];

  function decide(next: ReviewStatus, message: string) {
    if (!active) return;
    setProfiles((list) =>
      list.map((p) => (p.id === active.id ? { ...p, review_status: next } : p)),
    );
    toast.success(`${active.name} — ${message}`);
  }

  return (
    <div className="luxedesk min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-lg border border-primary/40 bg-primary/10 text-primary">
              <Gem className="size-4" aria-hidden="true" />
            </span>
            <div className="leading-tight">
              <h1 className="text-lg font-semibold tracking-tight text-foreground">LuxeDesk</h1>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Member review
              </p>
            </div>
          </div>

          <div className="order-3 grid w-full grid-cols-2 gap-2 sm:order-none sm:ml-auto sm:w-auto sm:grid-cols-4">
            <Metric label="Profiles" value={metrics.total} icon={Users} />
            <Metric label="Pending" value={metrics.pending} icon={ShieldCheck} />
            <Metric label="Approved" value={metrics.approved} icon={BadgeCheck} />
            <Metric label="Flagged" value={metrics.flagged} icon={Flag} />
          </div>

          <Avatar className="ml-auto size-9 border border-border sm:ml-3">
            <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
              AD
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5">
        <section className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, occupation or city"
              aria-label="Search profiles"
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="sm:w-44" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
              <SelectItem value="Flagged">Flagged</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tier} onValueChange={(v) => setTier(v as typeof tier)}>
            <SelectTrigger className="sm:w-48" aria-label="Filter by tier">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tiers</SelectItem>
              <SelectItem value="Standard">Standard</SelectItem>
              <SelectItem value="VIP Gold">VIP Gold</SelectItem>
              <SelectItem value="VIP Platinum">VIP Platinum</SelectItem>
            </SelectContent>
          </Select>
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <section aria-label="Profile queue" className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Queue ({filtered.length})
            </h2>
            {filtered.length === 0 && (
              <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                No applicants match these filters.
              </p>
            )}
            <ul className="space-y-3 lg:max-h-[70vh] lg:overflow-y-auto lg:pr-1">
              {filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(p.id)}
                    aria-current={active?.id === p.id}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors",
                      active?.id === p.id
                        ? "border-primary/60 ring-1 ring-primary/30"
                        : "border-border hover:border-primary/35",
                    )}
                  >
                    <img
                      src={p.profile_image}
                      alt={`${p.name}, ${p.occupation}`}
                      loading="lazy"
                      className="size-16 shrink-0 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-card-foreground">
                        {p.name}, {p.age}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{p.occupation}</p>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <MapPin className="size-3" aria-hidden="true" />
                        {p.location}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={p.review_status} />
                        <TierBadge tier={p.verification_tier} />
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {active && (
            <section
              aria-label="Review and verification inspector"
              className="rounded-2xl border border-border bg-card p-4"
            >
              <div className="overflow-hidden rounded-xl border border-border">
                <img
                  src={active.profile_image}
                  alt={`${active.name} — full profile photo`}
                  className="max-h-[420px] w-full object-cover"
                />
              </div>

              <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-card-foreground">
                    {active.name}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {active.age} · {active.relationship_status} · {active.occupation} ·{" "}
                    {active.location}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={active.review_status} />
                  <TierBadge tier={active.verification_tier} />
                </div>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-foreground/90">{active.bio}</p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {active.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="rounded-full text-[11px]">
                    {t}
                  </Badge>
                ))}
              </div>

              <dl className="mt-4 grid gap-2 rounded-xl border border-border bg-background/40 p-3 text-xs sm:grid-cols-2">
                {(
                  [
                    ["Member ID", active.id],
                    ["Applied", new Date(active.joined).toLocaleDateString()],
                    ["ID verified", active.id_verified ? "Yes" : "Outstanding"],
                    ["Photo verified", active.photo_verified ? "Yes" : "Outstanding"],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-medium text-foreground">{v}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => decide("Approved", "approved for membership")}>
                  <Check className="size-4" aria-hidden="true" /> Approve
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => decide("Flagged", "re-verification requested")}
                >
                  <RotateCcw className="size-4" aria-hidden="true" /> Request re-verification
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => decide("Rejected", "application declined")}
                >
                  <X className="size-4" aria-hidden="true" /> Decline
                </Button>
              </div>

              <div className="mt-5">
                <label
                  htmlFor="mod-notes"
                  className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                >
                  Moderation notes
                </label>
                <Textarea
                  id="mod-notes"
                  rows={4}
                  className="mt-2"
                  placeholder="Record verification evidence, escalation reasons or follow-ups…"
                  value={notes[active.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [active.id]: e.target.value }))}
                />
                <div className="mt-2 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast.success("Note saved to the review log.")}
                  >
                    Save note
                  </Button>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
