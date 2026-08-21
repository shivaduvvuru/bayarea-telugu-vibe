import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCheck, Lock, RefreshCw, Star, X } from "lucide-react";
import { checkDesk, lockDesk, unlockDesk } from "@/lib/desk-gate.functions";
import {
  adminListTempleSources,
  listTempleReviewQueue,
  refreshTempleCalendar,
  reviewTempleEvents,
  saveTempleSource,
  type TempleSourceDTO,
} from "@/lib/temple-calendar.functions";
import type { TempleEventDTO } from "@/lib/temple-calendar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/temple-sources")({
  head: () => ({
    meta: [
      { title: "Temple Sources — Times Bay Area desk" },
      {
        name: "description",
        content:
          "Editorial control for the Bay Area Temple Calendar: temple sources, feed health and imported program review.",
      },
      { property: "og:title", content: "Temple Sources — Times Bay Area desk" },
      { property: "og:description", content: "Temple calendar sources and review queue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TempleSourcesPage,
});

function TempleSourcesPage() {
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
        <p className="text-sm text-muted-foreground">Loading temple desk…</p>
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
          <h1 className="text-lg font-semibold">Temple Calendar desk</h1>
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

const HEALTH: Record<string, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-destructive",
};

function Workspace({ deskToken, onLock }: { deskToken: string; onLock: () => Promise<void> }) {
  const [sources, setSources] = useState<TempleSourceDTO[]>([]);
  const [queue, setQueue] = useState<TempleEventDTO[]>([]);
  const [busy, setBusy] = useState(false);
  const loadSources = useServerFn(adminListTempleSources);
  const loadQueue = useServerFn(listTempleReviewQueue);
  const doRefresh = useServerFn(refreshTempleCalendar);
  const doReview = useServerFn(reviewTempleEvents);
  const doSave = useServerFn(saveTempleSource);

  const reload = useCallback(async () => {
    const [s, q] = await Promise.all([
      loadSources({ data: { deskToken } }).catch(() => [] as TempleSourceDTO[]),
      loadQueue({ data: { deskToken } }).catch(() => [] as TempleEventDTO[]),
    ]);
    setSources(s);
    setQueue(q);
  }, [deskToken, loadQueue, loadSources]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function refresh(slug?: string) {
    setBusy(true);
    try {
      const res = await doRefresh({ data: { deskToken, ...(slug ? { slug } : {}) } });
      toast.success(
        `Checked ${res.checked} temple${res.checked === 1 ? "" : "s"} · ${res.created} new, ${res.updated} updated, ${res.needsReview} to review`,
      );
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setBusy(false);
    }
  }

  async function review(ids: string[], action: "publish" | "reject" | "feature") {
    if (ids.length === 0) return;
    try {
      await doReview({ data: { deskToken, ids, action } });
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Temple Calendar desk</h1>
          <p className="text-sm text-muted-foreground">
            {sources.length} temple sources ·{" "}
            <Link to="/temples/calendar" className="font-semibold text-primary">
              view public calendar
            </Link>
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => refresh()} disabled={busy}>
            <RefreshCw className="mr-1.5 size-4" aria-hidden="true" />
            {busy ? "Collecting…" : "Refresh all now"}
          </Button>
          <Button variant="outline" onClick={onLock}>
            Lock
          </Button>
        </div>
      </header>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-ink">Pending imported programs ({queue.length})</h2>
        {queue.length > 0 && (
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => review(queue.map((q) => q.id), "publish")}>
              <CheckCheck className="mr-1.5 size-4" aria-hidden="true" /> Approve all
            </Button>
          </div>
        )}
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
          {queue.length === 0 && (
            <li className="p-4 text-sm text-muted-foreground">Nothing waiting for review.</li>
          )}
          {queue.map((e) => (
            <li key={e.id} className="flex flex-wrap items-start gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-ink">{e.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[e.templeName, e.city, new Date(e.startsAt).toLocaleString("en-US")]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{e.eventType}</Badge>
                  {e.deities.map((d) => (
                    <Badge key={d} variant="outline">
                      {d}
                    </Badge>
                  ))}
                  {e.sourceUrl && (
                    <a
                      href={e.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-primary"
                    >
                      source
                    </a>
                  )}
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" onClick={() => review([e.id], "publish")}>
                  Publish
                </Button>
                <Button size="sm" variant="outline" onClick={() => review([e.id], "feature")}>
                  <Star className="size-4" aria-hidden="true" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => review([e.id], "reject")}>
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-ink">Temple sources & feed health</h2>
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
          {sources.map((s) => (
            <li key={s.id} className="p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                    <span
                      className={`size-2.5 rounded-full ${HEALTH[s.status] ?? "bg-muted"}`}
                      aria-label={`Source status ${s.status}`}
                    />
                    {s.name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[s.city, s.icsUrl ? "ICS feed" : s.rssUrl ? "RSS feed" : "page scan"]
                      .filter(Boolean)
                      .join(" · ")}
                    {s.lastCheckedAt &&
                      ` · checked ${new Date(s.lastCheckedAt).toLocaleString("en-US")}`}
                  </p>
                  {s.lastError && (
                    <p className="mt-0.5 text-xs text-destructive">{s.lastError}</p>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => refresh(s.slug)} disabled={busy}>
                    Refresh
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await doSave({
                        data: {
                          deskToken,
                          slug: s.slug,
                          name: s.name,
                          autoImport: !s.autoImport,
                        },
                      }).catch((e) =>
                        toast.error(e instanceof Error ? e.message : "Update failed"),
                      );
                      await reload();
                    }}
                  >
                    {s.autoImport ? "Pause import" : "Resume import"}
                  </Button>
                </div>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <FeedField
                  label="Calendar / events page"
                  value={s.eventsUrl ?? ""}
                  onSave={async (v) => {
                    await doSave({ data: { deskToken, slug: s.slug, name: s.name, eventsUrl: v } });
                    await reload();
                  }}
                />
                <FeedField
                  label="ICS / iCal feed"
                  value={s.icsUrl ?? ""}
                  onSave={async (v) => {
                    await doSave({ data: { deskToken, slug: s.slug, name: s.name, icsUrl: v } });
                    await reload();
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function FeedField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string;
  onSave: (v: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="flex gap-1.5">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="https://…" />
        <Button
          size="sm"
          variant="outline"
          disabled={draft === value}
          onClick={() =>
            onSave(draft).catch((e) => toast.error(e instanceof Error ? e.message : "Save failed"))
          }
        >
          Save
        </Button>
      </span>
    </label>
  );
}
