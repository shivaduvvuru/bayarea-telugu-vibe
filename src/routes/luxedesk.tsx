import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  BadgeCheck,
  Check,
  Crown,
  Film,
  Flag,
  Gem,
  Globe2,
  Images,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import {
  GLAMOUR_PROFILES,
  REGION_LABEL,
  type GlamourProfile,
  type Region,
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
      { title: "LuxeDesk — Glamour Celebrity Review Desk" },
      {
        name: "description",
        content:
          "Editorial console for reviewing curated female glamour and celebrity portraits from Hollywood, Indian cinema, Korea, Japan and China.",
      },
      { property: "og:title", content: "LuxeDesk — Glamour Celebrity Review Desk" },
      {
        property: "og:description",
        content:
          "Review curated solo glamour portraits by region, verify rights and single-subject framing, and approve for publication.",
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

const REGION_FILTERS: Array<"all" | Region> = ["all", "US", "India", "Korea", "Japan", "China"];

const REGION_CHIP: Record<"all" | Region, string> = {
  all: "All",
  US: "US",
  India: "India",
  Korea: "Korea",
  Japan: "Japan",
  China: "China",
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
  icon: typeof Images;
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
  const [profiles, setProfiles] = useState<GlamourProfile[]>(GLAMOUR_PROFILES);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | ReviewStatus>("all");
  const [tier, setTier] = useState<"all" | VerificationTier>("all");
  const [region, setRegion] = useState<"all" | Region>("all");
  const [activeId, setActiveId] = useState(GLAMOUR_PROFILES[0]!.id);
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
      if (region !== "all" && p.region !== region) return false;
      if (!q) return true;
      return [p.name, p.industry, p.profession, ...p.notable_works].some((f) =>
        f.toLowerCase().includes(q),
      );
    });
  }, [profiles, query, status, tier, region]);

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
                Glamour celebrity review
              </p>
            </div>
          </div>

          <div className="order-3 grid w-full grid-cols-2 gap-2 sm:order-none sm:ml-auto sm:w-auto sm:grid-cols-4">
            <Metric label="Frames" value={metrics.total} icon={Images} />
            <Metric label="Pending" value={metrics.pending} icon={ShieldCheck} />
            <Metric label="Approved" value={metrics.approved} icon={BadgeCheck} />
            <Metric label="Flagged" value={metrics.flagged} icon={Flag} />
          </div>

          <Avatar className="ml-auto size-9 border border-border sm:ml-3">
            <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
              ED
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5">
        <nav aria-label="Filter by region" className="flex flex-wrap gap-2">
          {REGION_FILTERS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRegion(r)}
              aria-pressed={region === r}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                region === r
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/35",
              )}
            >
              {REGION_CHIP[r]}
            </button>
          ))}
        </nav>

        <section className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, industry, profession or credits"
              aria-label="Search glamour profiles"
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

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Images className="size-4" aria-hidden="true" /> Glamour frames ({filtered.length})
          </div>
          {filtered.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(checked) =>
                  setSelected(checked ? new Set(filtered.map((p) => p.id)) : new Set())
                }
                aria-label="Select all frames shown"
              />
              <span>{selected.size ? `${selected.size} selected` : "Select shown frames"}</span>
              <Button size="sm" onClick={() => bulk("Approved", "approved")} disabled={!selectedIds.length}>
                <Check className="size-4" aria-hidden="true" /> Bulk approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => bulk("Rejected", "rejected")}
                disabled={!selectedIds.length}
              >
                <X className="size-4" aria-hidden="true" /> Bulk reject
              </Button>
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <Card className="mt-4 p-8 text-center text-sm text-muted-foreground">
            No curated frames match these filters.
          </Card>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => {
              const isSelected = selected.has(p.id);
              const Tier = TIER_ICON[p.verification_tier];
              const toggle = () =>
                setSelected((current) => {
                  const next = new Set(current);
                  if (next.has(p.id)) next.delete(p.id);
                  else next.add(p.id);
                  return next;
                });
              return (
                <li key={p.id}>
                  <Card
                    className={cn(
                      "h-full gap-3 overflow-hidden p-3",
                      isSelected && "ring-2 ring-primary",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggle()}
                        aria-label={`Select ${p.name}`}
                      />
                      <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                        <StatusBadge status={p.review_status} />
                        <Badge variant="secondary" className="rounded-full text-[11px]">
                          <Globe2 className="size-3" aria-hidden="true" /> {REGION_LABEL[p.region]}
                        </Badge>
                        <Badge variant="outline" className="rounded-full text-[11px]">
                          <Tier className="size-3" aria-hidden="true" /> {p.verification_tier}
                        </Badge>
                      </div>
                    </div>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={toggle}
                        aria-pressed={isSelected}
                        aria-label={`Toggle selection for ${p.name}`}
                        className="block w-full"
                      >
                        <img
                          src={p.profile_image}
                          alt={`${p.name} — ${p.image_style.toLowerCase()} glamour frame`}
                          loading="lazy"
                          decoding="async"
                          className="aspect-[4/5] w-full rounded-md border border-border object-cover object-top"
                        />
                      </button>
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute right-2 top-2 size-8 shadow-md"
                        title="Reject frame"
                        onClick={() => decide(p.id, "Rejected", "frame rejected")}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        <span className="sr-only">Reject frame</span>
                      </Button>
                    </div>

                    <h2 className="text-sm font-semibold text-card-foreground">{p.name}</h2>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Film className="size-3" aria-hidden="true" />
                      {p.industry} · {p.profession}
                    </p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      Notable works: {p.notable_works.join(", ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.solo_verified ? "Single subject verified" : "Single subject needs check"} ·{" "}
                      {p.rights_cleared ? "Rights cleared" : "Rights outstanding"}
                    </p>

                    <div className="mt-auto flex flex-wrap gap-2 pt-1">
                      {p.review_status !== "Approved" && (
                        <Button size="sm" onClick={() => decide(p.id, "Approved", "approved for publication")}>
                          <Check className="size-4" aria-hidden="true" /> Approve
                        </Button>
                      )}
                      {p.review_status !== "Rejected" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => decide(p.id, "Rejected", "frame rejected")}
                        >
                          <X className="size-4" aria-hidden="true" /> Reject
                        </Button>
                      )}
                      {p.review_status !== "Flagged" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Flag for re-check"
                          onClick={() => decide(p.id, "Flagged", "flagged for single-subject re-check")}
                        >
                          <RotateCcw className="size-4" aria-hidden="true" />
                          <span className="sr-only">Flag for re-check</span>
                        </Button>
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {filtered.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
            <label className="flex items-center gap-2 text-xs font-medium text-foreground">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(checked) =>
                  setSelected(checked ? new Set(filtered.map((p) => p.id)) : new Set())
                }
                aria-label="Select all remaining frames"
              />
              Select all remaining
            </label>
            <span className="text-xs text-muted-foreground">
              {selectedIds.length} of {filtered.length} selected
            </span>
            <Button
              className="ml-auto"
              onClick={() =>
                bulk("Approved", "approved", selectedIds.length ? selectedIds : filtered.map((p) => p.id))
              }
            >
              <Check className="size-4" aria-hidden="true" /> Approve &amp; publish (
              {selectedIds.length || filtered.length})
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
