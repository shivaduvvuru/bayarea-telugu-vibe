import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Check,
  X,
  RotateCcw,
  RefreshCw,
  Upload,
  CalendarDays,
  Newspaper,
  Landmark,
  ExternalLink,
  MapPin,
  Lock,
  Images,
  CopyX,
  Star,

} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useReviewQueue } from "@/lib/desk-queue";
import { listDeskItems } from "@/lib/desk-queue.functions";

import { CITIES, CITY_REGIONS, cityBySlug } from "@/lib/desk-cities";
import { todayISO, type DeskItem, type ItemKind, type ItemStatus } from "@/lib/desk";
import { unlockDesk, checkDesk, lockDesk } from "@/lib/desk-gate.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { galleryImage } from "@/lib/story-image";
import { celebrityName, eventLabel, industryLabel } from "@/lib/cinema-topics";
import { retryWithBackoff } from "@/lib/retry";

export const Route = createFileRoute("/desk")({
  head: () => ({
    meta: [
      { title: "Editorial review desk — Bay Area Telugu Times" },
      {
        name: "description",
        content:
          "Review and approve visually verified single-woman pictures before they publish to Glamour.",
      },
      { property: "og:title", content: "Editorial review desk — Bay Area Telugu Times" },
      {
        property: "og:description",
        content: "Review visually verified single-woman pictures for the Glamour section.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DeskPage,
});

const KIND_ICON: Record<ItemKind, typeof Newspaper> = {
  news: Newspaper,
  event: CalendarDays,
  temple: Landmark,
};

const WINDOW_DAYS = 7;


type DeskItemsResponse = {
  items: Array<{
    item_id: string;
    digest_date: string;
    kind: string;
    city_slug: string;
    title: string;
    summary: string | null;
    source: string | null;
    source_url: string | null;
    payload: Record<string, string | undefined> | null;
  }>;
};

function unwrapDeskItems(value: unknown): DeskItemsResponse | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (Array.isArray(record["items"])) return record as DeskItemsResponse;
  return unwrapDeskItems(record["data"] ?? record["result"]);
}

/**
 * The desk is a single-woman picture desk only. A title can describe one woman
 * while the artwork shows a couple or group, so only the visual-verification
 * marker is authoritative. Legacy rows stay hidden until the server checks the
 * actual image.
 */
function isPictureItem(item: DeskItem): boolean {
  return (
    item.reviewType === "picture" &&
    item.soloVerified === true &&
    !!galleryImage(item.image)
  );
}


function DeskPage() {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [deskToken, setDeskToken] = useState("");
  const [sessionError, setSessionError] = useState("");
  const doCheck = useServerFn(checkDesk);
  const doUnlock = useServerFn(unlockDesk);
  const doLock = useServerFn(lockDesk);
  const onSessionExpired = useCallback(() => setUnlocked(false), []);

  useEffect(() => {
    doCheck()
      .then((res) => {
        setDeskToken(res.deskToken ?? "");
        setUnlocked(res.unlocked);
      })
      .catch(() => {
        setSessionError("The desk session could not be checked. Please unlock again.");
        setUnlocked(false);
      });
  }, [doCheck]);

  const onUnlock = async (passcode: string) => {
    try {
      setSessionError("");
      const res = await doUnlock({ data: { passcode } });
      if (!res.ok) return false;
      setDeskToken(res.deskToken ?? "");
      // The unlock response writes the encrypted session cookie. Enter the
      // workspace from that authoritative result instead of immediately
      // racing a second request through the preview proxy; protected desk
      // queries still validate the cookie before returning any content.
      setUnlocked(true);
      return true;
    } catch {
      setSessionError("Could not unlock the desk. Please try again.");
      return false;
    }
  };

  const onLock = async () => {
    await doLock();
    setDeskToken("");
    setUnlocked(false);
  };

  if (unlocked === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading desk…</p>
      </div>
    );
  }

  if (!unlocked) {
    return <DeskPasscodeForm onUnlock={onUnlock} sessionError={sessionError} />;
  }

  return <DeskWorkspace deskToken={deskToken} onLock={onLock} onSessionExpired={onSessionExpired} />;
}

function DeskPasscodeForm({
  onUnlock,
  sessionError,
}: {
  onUnlock: (passcode: string) => Promise<boolean>;
  sessionError: string;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(false);
    const ok = await onUnlock(value);
    setBusy(false);
    if (!ok) setError(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-4 flex items-center gap-2">
          <Lock className="size-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">Editorial desk</h1>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Enter the editor passcode to review and publish stories.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <input
            name="passcode"
            type="password"
            autoComplete="current-password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Passcode"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
          {(error || sessionError) && (
            <p className="text-sm text-destructive">
              {sessionError || "Incorrect passcode."}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={busy || !value}>
            {busy ? "Checking…" : "Unlock desk"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function DeskWorkspace({
  deskToken,
  onLock,
  onSessionExpired,
}: {
  deskToken: string;
  onLock: () => Promise<void>;
  onSessionExpired: () => void;
}) {
  const date = todayISO();
  const [base, setBase] = useState<DeskItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retryNote, setRetryNote] = useState("");
  const autoRecoveryStarted = useRef(false);
  const fetchDeskItems = useServerFn(listDeskItems);

  const loadItems = useCallback(async () => {
    // Retry with backoff: a single timeout must never present as an empty desk.
    const mapped = await retryWithBackoff(
      async () => {
        const rawResponse = await fetchDeskItems({ data: { days: WINDOW_DAYS, deskToken } });
        const response = unwrapDeskItems(rawResponse);
        if (!response) throw new Error("The desk returned an invalid response");
        return response.items.map((r) => {
          const p = (r.payload ?? {}) as Record<string, string | undefined>;
          return {
            id: r.item_id,
            kind: r.kind as ItemKind,
            citySlug: r.city_slug,
            title: r.title,
            summary: r.summary ?? p["summary"] ?? "",
            source: r.source ?? p["source"] ?? "Web",
            sourceUrl: r.source_url ?? p["sourceUrl"] ?? "#",
            collectedAt: r.digest_date,
            ...(p["image"] ? { image: p["image"] } : {}),
            ...(p["review_type"] === "picture" ? { reviewType: "picture" as const } : {}),
            ...(p["solo_verified"] ? { soloVerified: true as const } : {}),
            ...(p["star"] ? { star: p["star"] } : {}),
            ...(p["industry"] ? { industry: p["industry"] } : {}),
            ...(p["event"] ? { event: p["event"] } : {}),
            ...(p["when"] ? { when: p["when"] } : {}),
            ...(p["venue"] ? { venue: p["venue"] } : {}),
            status: "pending" as const,
          } satisfies DeskItem;
        });
      },
      {
        attempts: 4,
        onRetry: (attempt) =>
          setRetryNote(`Desk was slow to answer — retrying (attempt ${attempt + 1} of 4)…`),
      },
    );
    setRetryNote("");
    // Text news publishes automatically and is never reviewed here — the desk
    // keeps only pictures, events and temple notices.
    const deskOnly = mapped.filter((i) => i.kind !== "news" || isPictureItem(i));
    setBase(deskOnly);
    return deskOnly;
  }, [deskToken, fetchDeskItems]);

  const reload = useCallback(() => {
    setLoadingItems(true);
    setLoadError("");
    return loadItems()
      .catch((e) => {
        console.error("desk load failed", e);
        const message = e instanceof Error ? e.message : "Desk items could not be loaded";
        setLoadError(message);
        if (/unauthorized|session|401/i.test(message)) onSessionExpired();
      })
      .finally(() => {
        setRetryNote("");
        setLoadingItems(false);
      });
  }, [loadItems, onSessionExpired]);

  useEffect(() => {
    void reload();
  }, [reload]);


  const ids = useMemo(() => base.map((i) => i.id), [base]);
  const queue = useReviewQueue(ids, `${date}-${ids.length}`, deskToken);

  const [region, setRegion] = useState<string>("all");
  const [city, setCity] = useState<string>("all");
  const [view, setView] = useState<ItemStatus | "all">("all");

  // Only single-woman pictures reach the desk; news, events and temple notices
  // publish automatically and are never held here for approval.
  const items: DeskItem[] = base
    .map((i) => ({ ...i, status: queue.statusOf(i.id) }))
    .filter(isPictureItem);

  const pictureCount = items.length;

  const counts = {
    all: items.length,
    pending: items.filter((i) => i.status === "pending").length,
    approved: items.filter((i) => i.status === "approved").length,
    rejected: items.filter((i) => i.status === "rejected").length,
  };

  const visible = items.filter((i) => {
    if (view !== "all" && i.status !== view) return false;

    if (city !== "all") return i.citySlug === city;
    if (region !== "all") return cityBySlug(i.citySlug)?.region === region;
    return true;
  });

  const decide = (id: string, status: ItemStatus) => {
    void queue.setStatus([id], status).catch(() => toast.error("Could not save decision"));
  };

  /** Marks an item as a duplicate: it leaves the desk and never comes back. */
  const markDuplicate = (id: string) => {
    void queue
      .setStatus([id], "rejected", "duplicate")
      .then(() => toast.success("Marked duplicate and removed"))
      .catch(() => toast.error("Could not mark duplicate"));
  };


  const bulk = (status: ItemStatus) => {
    void queue
      .setStatus(
        visible.map((i) => i.id),
        status,
      )
      .then(() => toast.success(`${visible.length} items marked ${status}`))
      .catch(() => toast.error("Could not save decisions"));
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/public/hooks/collect-news", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-Desk-Token": deskToken },
        // Desk recovery is specifically for held pictures. Avoid spending the
        // request budget on news, which publishes automatically and never needs
        // to occupy this review screen.
        body: JSON.stringify({ mode: "gallery", trigger: "manual" }),
      });
      const json = (await res.json()) as {
        collected?: number;
        error?: string;
        diag?: { fetched?: number; raw?: number; notes?: string[] };
        intakeHealth?: {
          attempts: number;
          pending: { news: number; pictures: number };
          healthy: boolean;
        };
      };
      if (res.status === 401) throw new Error("Desk session expired — unlock again");
      if (!res.ok) throw new Error(json.error ?? "Collection failed");
       let loaded = await loadItems();
       const expected = json.intakeHealth?.pending;
       const loadedPictures = loaded.filter(isPictureItem).length;
       // News publishes automatically and never waits in this desk, so only the
       // picture queue is verified after a collection run.
       if (expected && loadedPictures < expected.pictures) {
         setRetryNote("Collection completed — verifying the picture queue…");
         loaded = await retryWithBackoff(
           async () => {
             const next = await loadItems();
             if (next.filter(isPictureItem).length < expected.pictures) {
               throw new Error("Picture queue has not caught up yet");
             }
             return next;
           },
           { attempts: 4, baseDelayMs: 700 },
         );
       }
      if (!json.collected) {
        const note = json.diag?.notes?.[0];
        toast.warning(
          note
            ? `No new items — sources unreachable (${note})`
            : `No new items right now (${json.diag?.raw ?? 0} headlines scanned)`,
        );
       } else {
         const health = json.intakeHealth;
         toast.success(
           health
             ? `Pictures ready for approval: ${health.pending.pictures}${health.attempts > 1 ? ` · checked ${health.attempts} times` : ""}`
             : `Collected ${json.collected} items · ${loaded.length} awaiting review`,
         );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not refresh news");
    } finally {
      setRefreshing(false);
    }
  };

  // One automatic recovery pass on entry: only the picture desk is checked,
  // since news publishes automatically and never queues here.
  useEffect(() => {
    if (loadingItems || loadError || autoRecoveryStarted.current) return;
    const pictures = base.filter(isPictureItem).length;
    if (pictures >= 4) return;
    autoRecoveryStarted.current = true;
    setRetryNote("Picture intake is low — checking sources and collecting again…");
    void refresh();
  }, [base, loadError, loadingItems]);

  const publish = () => {
    void queue
      .processQueue()
      .then((n) =>
        n
          ? toast.success(`${n} items published to the site`)
          : toast.error("Nothing new approved to publish"),
      )
      .catch((e: Error) => toast.error(e.message || "Publishing failed"));
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl px-4 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Editorial desk
          </p>
          <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-foreground">
            Glamour picture review
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(date).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
              timeZone: "UTC",
            })}{" "}
            · {items.length} items from the last {WINDOW_DAYS} days across {CITIES.length} cities
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={refreshing}>
              <RefreshCw className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Collecting…" : "Collect now"}
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link to="/admin">Newsroom CMS</Link>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void onLock()}>
              <Lock className="size-3" /> Lock
            </Button>
          </div>
          {refreshing && (
            <p className="mt-2 text-xs font-medium text-primary" role="status">
              {retryNote || "Checking single-woman picture intake before approval…"}
            </p>
          )}

          <div className="mt-4 grid grid-cols-4 gap-2">
            {(["all", "pending", "approved", "rejected"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setView(s)}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  view === s ? "border-primary bg-accent" : "border-border bg-background"
                }`}
              >
                <span className="block text-lg font-bold text-foreground">{counts[s]}</span>
                <span className="block text-xs capitalize text-muted-foreground">{s}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-4 px-4 py-5">
        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground">
          <Images className="size-4" /> Pictures for review ({pictureCount})
        </div>


        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Filter by region"
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              setCity("all");
            }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="all">All regions</option>
            {CITY_REGIONS.map((r) => (
              <option key={r.key} value={r.en}>
                {r.en}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="all">All cities</option>
            {CITIES.filter((c) => region === "all" || c.region === region).map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.en}
              </option>
            ))}
          </select>
        </div>

        {(view === "pending" || view === "all") && visible.length > 0 && (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => bulk("approved")}>
              <Check /> Approve all remaining ({visible.length})
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulk("rejected")}>
              <X /> Reject all remaining
            </Button>
          </div>
        )}

        {loadingItems || queue.loading ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            {retryNote || "Loading desk…"}
          </Card>
        ) : loadError ? (
          <Card className="p-8 text-center text-sm text-destructive">
            <p>{loadError}</p>
            <Button variant="outline" className="mt-3" onClick={() => void reload()}>
              <RotateCcw className="mr-2 size-4" /> Try again
            </Button>
          </Card>
        ) : visible.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Nothing here. Change the filter, or use “Collect now” to pull fresh items.
          </Card>
        ) : (
          <ul className="space-y-3">
            {visible.map((item) => {
              const Icon = KIND_ICON[item.kind] ?? Newspaper;
              const c = cityBySlug(item.citySlug);
              const wood = item.industry ?? industryLabel(item.title, item.summary, item.sourceUrl);
              const star = item.star ?? celebrityName(item.title, item.summary);
              const shootEvent = item.event ?? eventLabel(item.title, item.summary);
              return (
                <li key={item.id}>
                  <Card className="gap-3 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="gap-1 bg-primary text-primary-foreground">
                        <Icon className="size-3" /> {wood}
                      </Badge>
                      {star && (
                        <Badge variant="secondary" className="gap-1">
                          <Star className="size-3" /> {star}
                        </Badge>
                      )}
                      {shootEvent && (
                        <Badge variant="secondary" className="gap-1">
                          <CalendarDays className="size-3" /> {shootEvent}
                        </Badge>
                      )}
                      <Badge variant="outline" className="gap-1">
                        <MapPin className="size-3" /> {c?.region ?? c?.en ?? item.citySlug}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <CalendarDays className="size-3" /> {item.collectedAt}
                      </Badge>
                      <Badge
                        variant={item.status === "approved" ? "default" : "outline"}
                        className="ml-auto capitalize"
                      >
                        {item.status}
                      </Badge>
                    </div>

                    {galleryImage(item.image) ? (
                      <img
                        src={galleryImage(item.image) ?? undefined}
                        alt={item.title}
                        loading="lazy"
                        decoding="async"
                        className="max-h-96 w-full rounded-md border border-border object-cover object-top"
                      />
                    ) : null}
                    <h2 className="text-base font-semibold leading-snug text-foreground">
                      {item.title}
                    </h2>
                    <p className="text-sm text-muted-foreground">{item.summary}</p>
                    {(item.when || item.venue) && (
                      <p className="text-xs text-muted-foreground">
                        {item.when} {item.venue ? `· ${item.venue}` : ""}
                      </p>
                    )}
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      {item.source} <ExternalLink className="size-3" />
                    </a>
                    <div className="flex gap-2 pt-1">
                      {item.status !== "approved" && (
                        <Button size="sm" onClick={() => decide(item.id, "approved")}>
                          <Check /> Approve
                        </Button>
                      )}
                      {item.status !== "rejected" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => decide(item.id, "rejected")}
                        >
                          <X /> Reject
                        </Button>
                      )}
                      {item.status !== "rejected" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => markDuplicate(item.id)}
                          title="Same story already on the site — remove and never re-collect"
                        >
                          <CopyX /> Duplicate
                        </Button>
                      )}

                      {item.status !== "pending" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => decide(item.id, "pending")}
                        >
                          <RotateCcw /> Undo
                        </Button>
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 pb-16 backdrop-blur md:pb-0">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{queue.uploadCounts.ready}</span> ready ·{" "}
            <span className="font-semibold text-foreground">{queue.uploadCounts.sent}</span> published
            {queue.uploadCounts.failed ? ` · ${queue.uploadCounts.failed} failed` : ""}
          </p>
          <Button onClick={publish} disabled={queue.busy || queue.loading}>
            <Upload /> {queue.busy ? "Publishing…" : "Publish approved"}
          </Button>
        </div>
      </div>
    </div>
  );
}
