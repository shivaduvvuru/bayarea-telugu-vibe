import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useReviewQueue } from "@/lib/desk-queue";
import { listDeskItems } from "@/lib/desk-queue.functions";

import { CITIES, CITY_REGIONS, cityBySlug } from "@/lib/desk-cities";
import { KIND_LABEL, todayISO, type DeskItem, type ItemKind, type ItemStatus } from "@/lib/desk";
import { unlockDesk, checkDesk, lockDesk } from "@/lib/desk-gate.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isStarGallery } from "@/lib/cinema-topics";
import { galleryImage } from "@/lib/story-image";

export const Route = createFileRoute("/desk")({
  head: () => ({
    meta: [
      { title: "Editorial review desk — Bay Area Telugu Times" },
      {
        name: "description",
        content:
          "Review, approve or reject collected Bay Area news, events and temple updates before they publish to the site.",
      },
      { property: "og:title", content: "Editorial review desk — Bay Area Telugu Times" },
      {
        property: "og:description",
        content: "Moderate collected Bay Area city news, events and temple updates.",
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

/** Desk tabs: pictures are reviewed on their own tab, apart from the news list. */
type DeskTab = ItemKind | "picture" | "all";

/**
 * A queue row belongs on the Pictures tab when it carries a usable photo that
 * passes the Glamourie quality check — those are reviewed as images, not text.
 */
function isPictureItem(item: DeskItem): boolean {
  return (
    !!galleryImage(item.image) && isStarGallery(item.title, item.summary, item.sourceUrl)
  );
}

function DeskPage() {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const doCheck = useServerFn(checkDesk);
  const doUnlock = useServerFn(unlockDesk);
  const doLock = useServerFn(lockDesk);

  useEffect(() => {
    doCheck()
      .then((res) => setUnlocked(res.unlocked))
      .catch(() => setUnlocked(false));
  }, [doCheck]);

  const onUnlock = async (passcode: string) => {
    const res = await doUnlock({ data: { passcode } });
    setUnlocked(res.ok);
    return res.ok;
  };

  const onLock = async () => {
    await doLock();
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
    return <DeskPasscodeForm onUnlock={onUnlock} />;
  }

  return <DeskWorkspace onLock={onLock} />;
}

function DeskPasscodeForm({ onUnlock }: { onUnlock: (passcode: string) => Promise<boolean> }) {
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
          {error && <p className="text-sm text-destructive">Incorrect passcode.</p>}
          <Button type="submit" className="w-full" disabled={busy || !value}>
            {busy ? "Checking…" : "Unlock desk"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function DeskWorkspace({ onLock }: { onLock: () => Promise<void> }) {
  const date = todayISO();
  const [base, setBase] = useState<DeskItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingItems, setLoadingItems] = useState(true);
  const fetchDeskItems = useServerFn(listDeskItems);

  const loadItems = useCallback(async () => {
    const data = await fetchDeskItems({ data: { days: WINDOW_DAYS } });
    const mapped: DeskItem[] = (data ?? []).map((r) => {
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
        ...(p["when"] ? { when: p["when"] } : {}),
        ...(p["venue"] ? { venue: p["venue"] } : {}),
        status: "pending" as const,
      };
    });
    setBase(mapped);
    return mapped;
  }, []);

  useEffect(() => {
    setLoadingItems(true);
    void loadItems()
      .catch((e) => console.error("desk load failed", e))
      .finally(() => setLoadingItems(false));
  }, [loadItems]);

  const ids = useMemo(() => base.map((i) => i.id), [base]);
  const queue = useReviewQueue(ids, `${date}-${ids.length}`);

  const [kind, setKind] = useState<DeskTab>("all");
  const [region, setRegion] = useState<string>("all");
  const [city, setCity] = useState<string>("all");
  const [view, setView] = useState<ItemStatus | "all">("all");

  const items: DeskItem[] = base.map((i) => ({ ...i, status: queue.statusOf(i.id) }));

  const pictureCount = items.filter(isPictureItem).length;

  const counts = {
    all: items.length,
    pending: items.filter((i) => i.status === "pending").length,
    approved: items.filter((i) => i.status === "approved").length,
    rejected: items.filter((i) => i.status === "rejected").length,
  };

  const visible = items.filter((i) => {
    if (view !== "all" && i.status !== view) return false;
    // Pictures get their own tab; the news tab keeps only text stories.
    if (kind === "picture" && !isPictureItem(i)) return false;
    if (kind === "news" && (i.kind !== "news" || isPictureItem(i))) return false;
    if (kind !== "all" && kind !== "picture" && kind !== "news" && i.kind !== kind) return false;
    if (city !== "all") return i.citySlug === city;
    if (region !== "all") return cityBySlug(i.citySlug)?.region === region;
    return true;
  });

  const decide = (id: string, status: ItemStatus) => {
    void queue.setStatus([id], status).catch(() => toast.error("Could not save decision"));
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
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = (await res.json()) as {
        collected?: number;
        error?: string;
        diag?: { fetched?: number; raw?: number; notes?: string[] };
      };
      if (res.status === 401) throw new Error("Desk session expired — unlock again");
      if (!res.ok) throw new Error(json.error ?? "Collection failed");
      await loadItems();
      if (!json.collected) {
        const note = json.diag?.notes?.[0];
        toast.warning(
          note
            ? `No new items — sources unreachable (${note})`
            : `No new items right now (${json.diag?.raw ?? 0} headlines scanned)`,
        );
      } else {
        toast.success(`Collected ${json.collected} items from live sources`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not refresh news");
    } finally {
      setRefreshing(false);
    }
  };

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
            Daily digest — review &amp; approve
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
        <Tabs value={kind} onValueChange={(v) => setKind(v as DeskTab)}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">
              All
            </TabsTrigger>
            <TabsTrigger value="news" className="flex-1">
              News
            </TabsTrigger>
            <TabsTrigger value="picture" className="flex-1 gap-1">
              <Images className="size-3" /> Pictures ({pictureCount})
            </TabsTrigger>
            <TabsTrigger value="event" className="flex-1">
              Events
            </TabsTrigger>
            <TabsTrigger value="temple" className="flex-1">
              Temples
            </TabsTrigger>
          </TabsList>
        </Tabs>

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
          <Card className="p-8 text-center text-sm text-muted-foreground">Loading desk…</Card>
        ) : visible.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Nothing here. Switch tab or filter, or use “Collect now” to pull fresh items.
          </Card>
        ) : (
          <ul className="space-y-3">
            {visible.map((item) => {
              const Icon = KIND_ICON[item.kind] ?? Newspaper;
              const c = cityBySlug(item.citySlug);
              return (
                <li key={item.id}>
                  <Card className="gap-3 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="gap-1">
                        <Icon className="size-3" /> {KIND_LABEL[item.kind] ?? item.kind}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <MapPin className="size-3" /> {c?.en ?? item.citySlug}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{c?.region}</span>
                      <Badge
                        variant={item.status === "approved" ? "default" : "outline"}
                        className="ml-auto capitalize"
                      >
                        {item.status}
                      </Badge>
                    </div>
                    {galleryImage(item.image) && (
                      <img
                        src={galleryImage(item.image)!}
                        alt={item.title}
                        loading="lazy"
                        decoding="async"
                        className={`w-full rounded-md border border-border object-cover ${
                          kind === "picture" ? "max-h-96 object-top" : "max-h-56"
                        }`}
                      />
                    )}
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
