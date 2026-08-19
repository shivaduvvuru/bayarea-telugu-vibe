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
  const selectedIds = useMemo(() => [...selected], [selected]);
  const allOnPageSelected = items.length > 0 && items.every((item) => selected.has(item.item_id));

  const act = async (stage: "pending" | "approved" | "rejected" | "duplicate", ids = selectedIds) => {
    if (!ids.length) return;
    setActing(true);
    try {
      await moveItems({ data: { itemIds: ids, stage, deskToken } });
      if (stage === "approved") {
        const result = await publishApproved({ data: { itemIds: ids, deskToken } });
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

        {items.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-y border-border py-3">
            <Checkbox checked={allOnPageSelected} onCheckedChange={(checked) => setSelected(checked ? new Set(items.map((item) => item.item_id)) : new Set())} aria-label="Select all pictures on this page" />
            <span className="mr-2 text-xs text-muted-foreground">{selected.size ? `${selected.size} selected` : "Select this page"}</span>
            <Button size="sm" onClick={() => void act("approved")} disabled={!selected.size || acting}><Check /> Bulk approve</Button>
            <Button size="sm" variant="outline" onClick={() => void act("rejected")} disabled={!selected.size || acting}><X /> Bulk reject</Button>
            {bucket === "safety_blocked" && <Button size="sm" variant="secondary" onClick={() => void act("pending")} disabled={!selected.size || acting}><RotateCcw /> Override to pending</Button>}
          </div>
        )}

        {loading ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">Loading {BUCKETS.find((entry) => entry.key === bucket)?.label.toLowerCase()}…</Card>
        ) : error ? (
          <Card className="p-8 text-center text-sm text-destructive"><p>{error}</p><Button variant="outline" className="mt-3" onClick={() => void load()}><RotateCcw /> Try again</Button></Card>
        ) : items.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">No pictures in this bucket.</Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <li key={item.item_id}>
                <Card className="h-full gap-3 overflow-hidden p-3">
                  <div className="flex items-start gap-2">
                    <Checkbox checked={selected.has(item.item_id)} onCheckedChange={(checked) => setSelected((current) => { const next = new Set(current); if (checked) next.add(item.item_id); else next.delete(item.item_id); return next; })} aria-label={`Select ${item.title}`} />
                    <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                      <Badge variant="outline">{item.stage.replace("_", " ")}</Badge>
                      {item.industry && <Badge variant="secondary">{item.industry}</Badge>}
                      {item.star && <Badge variant="secondary"><Star className="size-3" /> {item.star}</Badge>}
                    </div>
                  </div>
                  <img src={item.image_url} alt={item.title} loading="lazy" decoding="async" className="aspect-[4/5] w-full rounded-md border border-border object-cover object-top" />
                  {item.safety_reason && <p className="flex items-center gap-1 text-xs font-medium text-destructive"><AlertTriangle className="size-3" /> {REASON_LABEL[item.safety_reason] ?? item.safety_reason}</p>}
                  <h2 className="line-clamp-2 text-sm font-semibold text-foreground">{item.title}</h2>
                  <p className="text-xs text-muted-foreground">{new Date(item.discovered_at).toLocaleString()}</p>
                  {item.source_url && <a href={item.source_url} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline">{item.source ?? "Source"} <ExternalLink className="size-3" /></a>}
                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    {item.stage !== "approved" && <Button size="sm" onClick={() => void act("approved", [item.item_id])} disabled={acting}><Check /> Approve</Button>}
                    {item.stage !== "rejected" && <Button size="sm" variant="outline" onClick={() => void act("rejected", [item.item_id])} disabled={acting}><X /> Reject</Button>}
                    {item.stage === "safety_blocked" && <Button size="sm" variant="secondary" onClick={() => void act("pending", [item.item_id])} disabled={acting}><RotateCcw /> Override</Button>}
                    {item.stage !== "duplicate" && <Button size="icon" variant="ghost" title="Mark duplicate" onClick={() => void act("duplicate", [item.item_id])} disabled={acting}><CopyX /><span className="sr-only">Mark duplicate</span></Button>}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between border-t border-border pt-4">
          <Button variant="outline" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading}><ChevronLeft /> Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page} of {pageCount}</span>
          <Button variant="outline" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page >= pageCount || loading}>Next <ChevronRight /></Button>
        </div>
      </main>
    </div>
  );
}