import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Lock, RefreshCw } from "lucide-react";
import { checkDesk, lockDesk, unlockDesk } from "@/lib/desk-gate.functions";
import { propertyCampaignStats, updateCampaign, getCampaign } from "@/lib/property.functions";
import type { CampaignStats } from "@/lib/property.server";
import type { PropertyCampaign } from "@/lib/property";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const CAMPAIGN = "credai-hyderabad-2026";

export const Route = createFileRoute("/property-desk")({
  head: () => ({
    meta: [
      { title: "Property desk — Times Bay Area" },
      {
        name: "description",
        content:
          "Editorial desk for property-show campaigns: event details, enquiries and per-project performance.",
      },
      { property: "og:title", content: "Property desk — Times Bay Area" },
      { property: "og:description", content: "Campaign details, leads and performance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PropertyDeskPage,
});

function PropertyDeskPage() {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [deskToken, setDeskToken] = useState("");
  const doCheck = useServerFn(checkDesk);
  const doUnlock = useServerFn(unlockDesk);
  const doLock = useServerFn(lockDesk);

  useEffect(() => {
    doCheck()
      .then((res) => {
        setDeskToken(res.deskToken ?? "");
        setUnlocked(res.unlocked);
      })
      .catch(() => setUnlocked(false));
  }, [doCheck]);

  if (unlocked === null)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading property desk…</p>
      </div>
    );

  if (!unlocked)
    return (
      <Passcode
        onUnlock={async (passcode) => {
          const res = await doUnlock({ data: { passcode } });
          if (!res.ok) return false;
          setDeskToken(res.deskToken ?? "");
          setUnlocked(true);
          return true;
        }}
      />
    );

  return (
    <Workspace
      deskToken={deskToken}
      onLock={async () => {
        await doLock();
        setDeskToken("");
        setUnlocked(false);
      }}
    />
  );
}

function Passcode({ onUnlock }: { onUnlock: (passcode: string) => Promise<boolean> }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-3 flex items-center gap-2">
          <Lock className="size-5 text-primary" aria-hidden="true" />
          <h1 className="text-lg font-semibold">Property desk</h1>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const ok = await onUnlock(value).catch(() => false);
            setBusy(false);
            setError(!ok);
          }}
          className="space-y-3"
        >
          <Input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Desk passcode"
            aria-label="Desk passcode"
          />
          {error && <p className="text-sm text-destructive">That passcode did not match.</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Checking…" : "Unlock"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function Workspace({ deskToken, onLock }: { deskToken: string; onLock: () => Promise<void> }) {
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [campaign, setCampaign] = useState<PropertyCampaign | null>(null);
  const [busy, setBusy] = useState(false);
  const loadStats = useServerFn(propertyCampaignStats);
  const loadCampaign = useServerFn(getCampaign);
  const save = useServerFn(updateCampaign);

  const refresh = useCallback(async () => {
    setBusy(true);
    const [s, c] = await Promise.all([
      loadStats({ data: { campaignSlug: CAMPAIGN, deskToken } }).catch(() => null),
      loadCampaign({ data: { slug: CAMPAIGN } }).catch(() => null),
    ]);
    setStats(s);
    setCampaign(c?.campaign ?? null);
    setBusy(false);
  }, [deskToken, loadStats, loadCampaign]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-ink">Property desk — CREDAI Hyderabad 2026</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={busy}>
            <RefreshCw className="mr-1 size-4" aria-hidden /> Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void onLock()}>
            Sign out
          </Button>
        </div>
      </header>

      <p className="mt-1 text-xs text-muted-foreground">
        <Link to="/property/$campaign" params={{ campaign: CAMPAIGN }} className="font-bold text-primary">
          View the public page
        </Link>
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Page views" value={stats?.pageViews ?? 0} />
        <Metric label="Project views" value={stats?.projectViews ?? 0} />
        <Metric label="Developer clicks" value={stats?.developerClicks ?? 0} />
        <Metric label="Enquiries" value={stats?.enquiries ?? 0} />
      </div>

      {campaign ? (
        <Card className="mt-6 p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink">Event details</h2>
          <form
            className="mt-3 grid gap-3 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              setBusy(true);
              const res = await save({
                data: {
                  campaignSlug: CAMPAIGN,
                  deskToken,
                  patch: {
                    headline: String(form.get("headline") ?? ""),
                    subheading: String(form.get("subheading") ?? ""),
                    promo_title: String(form.get("promo_title") ?? ""),
                    promo_line: String(form.get("promo_line") ?? ""),
                    venue: String(form.get("venue") ?? ""),
                    organizer: String(form.get("organizer") ?? ""),
                    event_start: String(form.get("event_start") ?? ""),
                    event_end: String(form.get("event_end") ?? ""),
                    opening_hours: String(form.get("opening_hours") ?? ""),
                    official_url: String(form.get("official_url") ?? ""),
                    homepage_visible: form.get("homepage_visible") === "on",
                    post_event: form.get("post_event") === "on",
                  },
                },
              }).catch(() => null);
              setBusy(false);
              if (res?.ok) {
                toast.success("Campaign updated");
                void refresh();
              } else {
                toast.error("Could not save the campaign");
              }
            }}
          >
            <Field name="headline" label="Headline" defaultValue={campaign.headline} />
            <Field name="subheading" label="Subheading" defaultValue={campaign.subheading ?? ""} />
            <Field name="promo_title" label="Homepage title" defaultValue={campaign.promo_title ?? ""} />
            <Field name="promo_line" label="Homepage line" defaultValue={campaign.promo_line ?? ""} />
            <Field name="venue" label="Venue" defaultValue={campaign.venue ?? ""} />
            <Field name="organizer" label="Organiser" defaultValue={campaign.organizer ?? ""} />
            <Field name="event_start" label="Start date (YYYY-MM-DD)" defaultValue={campaign.event_start ?? ""} />
            <Field name="event_end" label="End date (YYYY-MM-DD)" defaultValue={campaign.event_end ?? ""} />
            <Field name="opening_hours" label="Opening hours" defaultValue={campaign.opening_hours ?? ""} />
            <Field name="official_url" label="Official URL" defaultValue={campaign.official_url ?? ""} />
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <input type="checkbox" name="homepage_visible" defaultChecked={campaign.homepage_visible} />
              Show the homepage module
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <input type="checkbox" name="post_event" defaultChecked={campaign.post_event} />
              Switch to post-event highlights
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy}>
                Save details
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card className="mt-6 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink">Per-project performance</h2>
        {stats && stats.byProject.length > 0 ? (
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-1">Project</th>
                <th className="py-1">Views</th>
                <th className="py-1">Enquiries</th>
              </tr>
            </thead>
            <tbody>
              {stats.byProject.map((p) => (
                <tr key={p.name} className="border-t border-border">
                  <td className="py-1.5 font-semibold text-ink">{p.name}</td>
                  <td className="py-1.5">{p.views}</td>
                  <td className="py-1.5">{p.enquiries}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No project activity recorded yet.</p>
        )}
      </Card>

      <Card className="mt-6 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink">Recent enquiries</h2>
        {stats && stats.recentLeads.length > 0 ? (
          <ul className="mt-2 space-y-3">
            {stats.recentLeads.map((l) => (
              <li key={`${l.created_at}-${l.email}`} className="border-t border-border pt-2 text-sm">
                <p className="font-semibold text-ink">
                  {l.name} · {l.email}
                  {l.phone ? ` · ${l.phone}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[l.country, l.budget, l.project_names.join(", ")].filter(Boolean).join(" · ")}
                </p>
                {l.message ? <p className="mt-1 text-xs text-ink">{l.message}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No enquiries yet.</p>
        )}
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-black text-ink">{value}</p>
    </Card>
  );
}

function Field({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: string;
}) {
  return (
    <label className="text-xs font-semibold text-muted-foreground">
      {label}
      <Input name={name} defaultValue={defaultValue} className="mt-1" />
    </label>
  );
}
