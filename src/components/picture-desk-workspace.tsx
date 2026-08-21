import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  CopyX,
  ExternalLink,
  Images,
  Lock,
  RefreshCw,
  RotateCcw,
  Star,
  Trash2,
  X,
} from "lucide-react";

import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { publishApproved as publishApprovedFn } from "@/lib/desk-publish.functions";
import {
  getPictureBucketCounts,
  listPictureBucket,
  setPictureBucket,
} from "@/lib/picture-intake.functions";

type Bucket = "usable" | "pending" | "approved" | "rejected" | "safety_blocked" | "discovered";
type IntakeItem = {
  item_id: string;
  queue_item_id: string | null;
  stage: string;
  image_url: string;
  title: string;
  summary: string | null;
  source: string | null;
  source_url: string | null;
  city_slug: string | null;
  industry: string | null;
  star: string | null;
  event: string | null;
  safety_reason: string | null;
  screening_state: string;
  discovered_at: string;
};

const PAGE_SIZES = [24, 48] as const;
const BUCKETS: Array<{ key: Bucket; label: string }> = [
  { key: "usable", label: "Ready for review" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Discarded" },
  { key: "safety_blocked", label: "Safety blocked" },
  { key: "discovered", label: "Raw feed" },
];

const REASON_LABEL: Record<string, string> = {
  no_primary_woman: "No primary woman detected",
  minor_or_age_uncertain: "Age uncertain",
  explicit_content: "Explicit content",
  image_corrupt: "Image could not be read",
};

type Category = "all" | "glamour" | "cinema" | "micro";
const CATEGORIES: Array<{ key: Category; label: string }> = [
  { key: "all", label: "All" },
  { key: "glamour", label: "Glamour (Single Woman)" },
  { key: "cinema", label: "Cinema / OTT" },
  { key: "micro", label: "Micro Drama" },
];

const MICRO = /micro[- ]?drama|duanju|short[- ]?drama|vertical drama|short-?form drama|reelshort|dramabox/i;

function categoryOf(item: IntakeItem): Exclude<Category, "all"> {
  const text = `${item.title} ${item.summary ?? ""} ${item.source ?? ""} ${item.event ?? ""}`;
  if (MICRO.test(text)) return "micro";
  if (item.screening_state === "passed" && !item.safety_reason) return "glamour";
  return "cinema";
}

function unwrap<T>(value: unknown, key: string): T | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (key in record) return record as T;
  return unwrap<T>(record["data"] ?? record["result"], key);
}


export function PictureDeskWorkspace({
  deskToken,
  onLock,
  onSessionExpired,
}: {
  deskToken: string;
  onLock: () => Promise<void>;
  onSessionExpired: () => void;
}) {
  const listBucket = useServerFn(listPictureBucket);
  const readCounts = useServerFn(getPictureBucketCounts);
  const moveItems = useServerFn(setPictureBucket);
  const publishApproved = useServerFn(publishApprovedFn);
  const [bucket, setBucket] = useState<Bucket>("pending");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(24);
  const [items, setItems] = useState<IntakeItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState<Category>("all");

  const [fetching, setFetching] = useState(false);
  const [acting, setActing] = useState(false);
  const [lastFetch, setLastFetch] = useState("");
  const autoRecoveryStarted = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [bucketRaw, countRaw] = await Promise.all([
        listBucket({ data: { bucket, page, pageSize, deskToken } }),
        readCounts({ data: { deskToken } }),
      ]);
      const result = unwrap<{ items: IntakeItem[]; total: number }>(bucketRaw, "items");
      const countResult = unwrap<Record<string, number>>(countRaw, "pending") ?? (countRaw as Record<string, number>);
      if (!result) throw new Error("The Desk returned an invalid response");
      setItems(result.items);
      setTotal(result.total);
      setCounts(countResult ?? {});
      setSelected(new Set());
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not load picture intake";
      setError(message);
      if (/unauthorized|session|401/i.test(message)) onSessionExpired();
    } finally {
      setLoading(false);
    }
  }, [bucket, deskToken, listBucket, onSessionExpired, page, pageSize, readCounts]);

  useEffect(() => {
    void load();
  }, [load]);

  const fetchPictures = useCallback(async () => {
    if (fetching) return;
    setFetching(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 115_000);
    try {
      const response = await fetch("/api/public/hooks/collect-news", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-Desk-Token": deskToken },
        body: JSON.stringify({ mode: "gallery", trigger: "manual" }),
        signal: controller.signal,
      });
      const json = (await response.json()) as {
        error?: string;
        buckets?: { discovered?: number; usable?: number; pending?: number; safetyBlocked?: number; duplicates?: number };
      };
      if (response.status === 401) throw new Error("Desk session expired — unlock again");
      if (!response.ok) throw new Error(json.error ?? "Picture collection failed");
      const result = json.buckets;
      const message = result
        ? `${result.pending ?? 0} ready · ${result.safetyBlocked ?? 0} safety blocked · ${result.duplicates ?? 0} duplicates`
        : "Picture collection completed";
      setLastFetch(message);
      toast.success(message);
      setPage(1);
      await load();
    } catch (caught) {
      const message = caught instanceof DOMException && caught.name === "AbortError"
        ? "Collection is still running in the background. The button is ready again."
        : caught instanceof Error
          ? caught.message
          : "Picture collection failed";
      setLastFetch(message);
      toast.error(message);
    } finally {
      window.clearTimeout(timeout);
      setFetching(false);
    }
  }, [deskToken, fetching, load]);

  useEffect(() => {
    if (loading || autoRecoveryStarted.current || fetching || (counts["pending"] ?? 0) >= 4) return;
    autoRecoveryStarted.current = true;
    void fetchPictures();
  }, [counts, fetchPictures, fetching, loading]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const visibleItems = useMemo(
    () => (category === "all" ? items : items.filter((item) => categoryOf(item) === category)),
    [category, items],
  );
  const categoryCounts = useMemo(() => {
    const tally: Record<string, number> = { all: items.length, glamour: 0, cinema: 0, micro: 0 };
    for (const item of items) tally[categoryOf(item)] = (tally[categoryOf(item)] ?? 0) + 1;
    return tally;
  }, [items]);
  const selectedIds = useMemo(
    () => visibleItems.filter((item) => selected.has(item.item_id)).map((item) => item.item_id),
    [selected, visibleItems],
  );
  const allVisibleSelected = visibleItems.length > 0 && visibleItems.every((item) => selected.has(item.item_id));

  const dropLocally = (ids: string[]) => {
    setItems((current) => current.filter((item) => !ids.includes(item.item_id)));
    setTotal((current) => Math.max(0, current - ids.length));
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) next.delete(id);
      return next;
    });
  };

  /** Single-card action: optimistic local removal, background write, no re-fetch. */
  const quickAct = (stage: "pending" | "approved" | "rejected" | "duplicate", item: IntakeItem) => {
    dropLocally([item.item_id]);
    setCounts((current) => ({ ...current, [bucket]: Math.max(0, (current[bucket] ?? 1) - 1) }));
    void (async () => {
      try {
        await moveItems({ data: { itemIds: [item.item_id], stage, deskToken } });
        if (stage === "approved") {
          const result = await publishApproved({ data: { itemIds: [item.queue_item_id ?? item.item_id], deskToken } });
          if (result.error) throw new Error(result.error);
        }
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : "Could not save the action");
      }
    })();
  };

  /** Batch action: one request, toast, then sync the desk. */
  const act = async (stage: "pending" | "approved" | "rejected" | "duplicate", ids = selectedIds) => {
    if (!ids.length) return;
    setActing(true);
    try {
      await moveItems({ data: { itemIds: ids, stage, deskToken } });
      if (stage === "approved") {
        const queueIds = items
          .filter((item) => ids.includes(item.item_id))
          .map((item) => item.queue_item_id ?? item.item_id);
        const result = await publishApproved({ data: { itemIds: queueIds, deskToken } });
        if (result.error) throw new Error(result.error);
      }
      toast.success(`${ids.length} picture${ids.length === 1 ? "" : "s"} ${stage === "pending" ? "moved to review" : stage}`);
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not save the action");
    } finally {
      setActing(false);
    }
  };


  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Editorial desk</p>
          <h1 className="mt-1 font-serif text-2xl font-bold text-foreground">Glamour picture review</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => void fetchPictures()} disabled={fetching}>
              <RefreshCw className={fetching ? "animate-spin" : ""} />
              {fetching ? "Collecting…" : "Fetch pictures"}
            </Button>
            <Button size="sm" variant="ghost" asChild><Link to="/admin">Newsroom CMS</Link></Button>
            <Button size="sm" variant="outline" asChild><Link to="/command-center">Command Center</Link></Button>
            <Button size="sm" variant="outline" asChild><Link to="/luxedesk">Applicant &amp; member review (LuxeDesk)</Link></Button>

            <Button size="sm" variant="ghost" onClick={() => void onLock()}><Lock className="size-3" /> Lock</Button>
          </div>
          {(fetching || lastFetch) && <p className="mt-2 text-xs text-muted-foreground" role="status">{fetching ? "Collecting and saving each intake stage…" : lastFetch}</p>}

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" role="tablist" aria-label="Picture intake buckets">
            {BUCKETS.map((entry) => (
              <Button
                key={entry.key}
                type="button"
                variant={bucket === entry.key ? "secondary" : "outline"}
                className="h-auto min-h-16 justify-start px-3 py-2 text-left"
                role="tab"
                aria-selected={bucket === entry.key}
                onClick={() => { setBucket(entry.key); setPage(1); }}
              >
                <span><strong className="block text-lg text-foreground">{counts[entry.key] ?? 0}</strong><span className="text-xs text-muted-foreground">{entry.label}</span></span>
              </Button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Images className="size-4" /> {BUCKETS.find((entry) => entry.key === bucket)?.label} ({total})</div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground" htmlFor="desk-page-size">Per page</label>
            <select id="desk-page-size" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value) as 24 | 48); setPage(1); }} className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground">
              {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Picture categories">
          {CATEGORIES.map((entry) => (
            <Button
              key={entry.key}
              type="button"
              size="sm"
              role="tab"
              aria-selected={category === entry.key}
              variant={category === entry.key ? "default" : "outline"}
              onClick={() => setCategory(entry.key)}
            >
              {entry.label} ({categoryCounts[entry.key] ?? 0})
            </Button>
          ))}
        </div>

        {visibleItems.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-y border-border py-3">
            <Checkbox
              checked={allVisibleSelected}
              onCheckedChange={(checked) => setSelected(checked ? new Set(visibleItems.map((item) => item.item_id)) : new Set())}
              aria-label="Select all pictures shown"
            />
            <span className="mr-2 text-xs text-muted-foreground">{selected.size ? `${selected.size} selected` : "Select shown pictures"}</span>
            <Button size="sm" onClick={() => void act("approved")} disabled={!selectedIds.length || acting}><Check /> Bulk approve</Button>
            <Button size="sm" variant="outline" onClick={() => void act("rejected")} disabled={!selectedIds.length || acting}><X /> Bulk reject</Button>
            {bucket === "safety_blocked" && <Button size="sm" variant="secondary" onClick={() => void act("pending")} disabled={!selectedIds.length || acting}><RotateCcw /> Override to pending</Button>}
          </div>
        )}

        {loading ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">Loading {BUCKETS.find((entry) => entry.key === bucket)?.label.toLowerCase()}…</Card>
        ) : error ? (
          <Card className="p-8 text-center text-sm text-destructive"><p>{error}</p><Button variant="outline" className="mt-3" onClick={() => void load()}><RotateCcw /> Try again</Button></Card>
        ) : visibleItems.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">No pictures in this view.</Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleItems.map((item) => {
              const isSelected = selected.has(item.item_id);
              const toggle = () => setSelected((current) => {
                const next = new Set(current);
                if (next.has(item.item_id)) next.delete(item.item_id); else next.add(item.item_id);
                return next;
              });
              return (
              <li key={item.item_id}>
                <Card className={`h-full gap-3 overflow-hidden p-3 ${isSelected ? "ring-2 ring-primary" : ""}`}>
                  <div className="flex items-start gap-2">
                    <Checkbox checked={isSelected} onCheckedChange={() => toggle()} aria-label={`Select ${item.title}`} />
                    <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                      <Badge variant="outline">{item.stage.replace("_", " ")}</Badge>
                      {item.industry && <Badge variant="secondary">{item.industry}</Badge>}
                      {item.star && <Badge variant="secondary"><Star className="size-3" /> {item.star}</Badge>}
                    </div>
                  </div>
                  <div className="relative">
                    <button type="button" onClick={toggle} className="block w-full" aria-pressed={isSelected} aria-label={`Toggle selection for ${item.title}`}>
                      <img src={item.image_url} alt={item.title} loading="lazy" decoding="async" className="aspect-[4/5] w-full rounded-md border border-border object-cover object-top" />
                    </button>
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute right-2 top-2 size-8 shadow-md"
                      title="Delete picture"
                      onClick={() => quickAct("rejected", item)}
                    >
                      <Trash2 className="size-4" /><span className="sr-only">Delete picture</span>
                    </Button>
                  </div>
                  {item.safety_reason && <p className="flex items-center gap-1 text-xs font-medium text-destructive"><AlertTriangle className="size-3" /> {REASON_LABEL[item.safety_reason] ?? item.safety_reason}</p>}
                  <h2 className="line-clamp-2 text-sm font-semibold text-foreground">{item.title}</h2>
                  <p className="text-xs text-muted-foreground">{new Date(item.discovered_at).toLocaleString()}</p>
                  {item.source_url && <a href={item.source_url} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline">{item.source ?? "Source"} <ExternalLink className="size-3" /></a>}
                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    {item.stage !== "approved" && <Button size="sm" onClick={() => quickAct("approved", item)}><Check /> Approve</Button>}
                    {item.stage !== "rejected" && <Button size="sm" variant="outline" onClick={() => quickAct("rejected", item)}><X /> Reject</Button>}
                    {item.stage === "safety_blocked" && <Button size="sm" variant="secondary" onClick={() => quickAct("pending", item)}><RotateCcw /> Override</Button>}
                    {item.stage !== "duplicate" && <Button size="icon" variant="ghost" title="Mark duplicate" onClick={() => quickAct("duplicate", item)}><CopyX /><span className="sr-only">Mark duplicate</span></Button>}
                  </div>
                </Card>
              </li>
              );
            })}
          </ul>
        )}


        <div className="flex items-center justify-between border-t border-border pt-4">
          <Button variant="outline" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading}><ChevronLeft /> Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page} of {pageCount}</span>
          <Button variant="outline" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page >= pageCount || loading}>Next <ChevronRight /></Button>
        </div>
      </main>

      {visibleItems.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
            <label className="flex items-center gap-2 text-xs font-medium text-foreground">
              <Checkbox
                checked={allVisibleSelected}
                onCheckedChange={(checked) => setSelected(checked ? new Set(visibleItems.map((item) => item.item_id)) : new Set())}
                aria-label="Select all remaining pictures"
              />
              Select All Remaining
            </label>
            <span className="text-xs text-muted-foreground">{selectedIds.length} of {visibleItems.length} selected</span>
            <Button
              className="ml-auto"
              onClick={() => void act("approved", selectedIds.length ? selectedIds : visibleItems.map((item) => item.item_id))}
              disabled={acting}
            >
              <Check /> {acting ? "Publishing…" : `Approve & Publish (${selectedIds.length || visibleItems.length})`}
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}