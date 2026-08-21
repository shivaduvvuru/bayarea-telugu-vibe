import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCheck,
  CopyX,
  ExternalLink,
  Lock,
  Plus,
  RefreshCw,
  Rss,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { checkDesk, lockDesk, unlockDesk } from "@/lib/desk-gate.functions";
import {
  commandCounters,
  deleteSource,
  listRegistry,
  listReviewQueue,
  massApproveQueue,
  purgeQueueItems,
  reviewItem,
  runIngestNow,
  saveSource,
  setSourceActive,
  type SourceInput,
} from "@/lib/command-center.functions";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/command-center")({
  head: () => ({
    meta: [
      { title: "Command Center — Times Bay Area" },
      {
        name: "description",
        content:
          "Source registry, ingestion health and the editorial review queue behind the Times Bay Area daily digest.",
      },
      { property: "og:title", content: "Command Center — Times Bay Area" },
      {
        property: "og:description",
        content: "Manage sources, watch ingestion health and approve today's digest.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CommandCenterPage,
});

const REJECT_REASONS = [
  "Not local",
  "Too generic",
  "Duplicate",
  "Old",
  "Low credibility",
  "Not useful",
  "Already covered",
  "Promotional",
  "Other",
] as const;

const SOURCE_CLASSES = ["authority", "reporter", "community", "organizer", "internal", "submission"] as const;
const CONNECTORS = ["direct_rss", "direct_api", "goodbarber", "manual", "webhook"] as const;
const CONFIDENCE = ["high", "medium", "low"] as const;

type SourceRow = SourceInput & {
  id: string;
  status: string;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  items_discovered: number;
  items_published: number;
  duplicates_removed: number;
};

type QueueRow = {
  id: string;
  source_name: string;
  original_title: string;
  canonical_url: string;
  excerpt: string | null;
  image_url: string | null;
  publication_datetime: string | null;
  city: string | null;
  topic: string | null;
  dedupe_status: string;
  processing_status: string;
  priority_score: number;
  requires_human_review: boolean;
  digest_headline: string | null;
  why_it_matters: string | null;
  what_to_do: string | null;
};

function CommandCenterPage() {
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
        <p className="text-sm text-muted-foreground">Loading Command Center…</p>
      </div>
    );

  if (!unlocked)
    return (
      <PasscodeForm
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

function PasscodeForm({ onUnlock }: { onUnlock: (passcode: string) => Promise<boolean> }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-3 flex items-center gap-2">
          <Lock className="size-5 text-primary" aria-hidden="true" />
          <h1 className="text-lg font-semibold">Times Bay Area Command Center</h1>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Enter the editor passcode to manage sources and today's digest.
        </p>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(!(await onUnlock(value)));
            setBusy(false);
          }}
        >
          <Input
            type="password"
            autoComplete="current-password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Passcode"
          />
          {error && <p className="text-sm text-destructive">Incorrect passcode.</p>}
          <Button type="submit" className="w-full" disabled={busy || !value}>
            {busy ? "Checking…" : "Unlock"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className={`text-lg font-semibold ${tone === "warn" && value > 0 ? "text-destructive" : "text-foreground"}`}>
        {value}
      </p>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function Workspace({ deskToken, onLock }: { deskToken: string; onLock: () => Promise<void> }) {
  const [tab, setTab] = useState<"queue" | "sources">("queue");
  const [counters, setCounters] = useState({
    collected: 0,
    duplicates: 0,
    recommended: 0,
    needsReview: 0,
    approved: 0,
    published: 0,
    sourceErrors: 0,
  });
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState("pending");
  const [busy, setBusy] = useState(false);
  const [collecting, setCollecting] = useState(false);

  const getCounters = useServerFn(commandCounters);
  const getQueue = useServerFn(listReviewQueue);
  const getRegistry = useServerFn(listRegistry);
  const decide = useServerFn(reviewItem);
  const collectNow = useServerFn(runIngestNow);
  const persistSource = useServerFn(saveSource);
  const toggleSource = useServerFn(setSourceActive);
  const removeSource = useServerFn(deleteSource);
  const approveAll = useServerFn(massApproveQueue);
  const purgeItems = useServerFn(purgeQueueItems);


  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [c, q, r] = await Promise.all([
        getCounters({ data: { deskToken } }),
        getQueue({ data: { deskToken, status: status === "pending" ? "" : status } }),
        getRegistry({ data: { deskToken } }),
      ]);
      setCounters(c);
      setRows((q.rows ?? []) as QueueRow[]);
      setSources((r.sources ?? []) as SourceRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load the Command Center");
    } finally {
      setBusy(false);
    }
  }, [deskToken, getCounters, getQueue, getRegistry, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedIds = useMemo(() => rows.filter((r) => selected.has(r.id)).map((r) => r.id), [rows, selected]);

  const act = async (
    action: "approve" | "reject" | "publish" | "duplicate" | "recommend",
    ids: string[],
    reason?: string,
  ) => {
    if (!ids.length) return;
    setRows((list) => list.filter((r) => !ids.includes(r.id)));
    setSelected(new Set());
    try {
      const res = await decide({
        data: { deskToken, ids, action, ...(reason ? { reason } : {}) },
      });
      if (res.error) throw new Error(res.error);
      toast.success(
        action === "publish"
          ? `Published ${res.published} item${res.published === 1 ? "" : "s"}`
          : `${ids.length} item${ids.length === 1 ? "" : "s"} ${action}d`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    }
    await load();
  };

  /** Editor dislike — permanent, site-wide deletion. */
  const dislike = async (ids: string[]) => {
    if (!ids.length) return;
    setRows((list) => list.filter((r) => !ids.includes(r.id)));
    setSelected(new Set());
    try {
      const res = await purgeItems({ data: { deskToken, ids } });
      if (res.error) throw new Error(res.error);
      toast.success(`Deleted ${res.deleted || ids.length} item${ids.length === 1 ? "" : "s"} permanently`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    }
    await load();
  };

  const massApprove = async () => {
    setBusy(true);
    try {
      const res = await approveAll({ data: { deskToken } });
      if (res.error) throw new Error(res.error);
      toast.success(`Approved ${res.approved} · published ${res.published}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Mass approve failed");
    } finally {
      setBusy(false);
      await load();
    }
  };



  const runCollect = async () => {
    setCollecting(true);
    try {
      const summary = await collectNow({ data: { deskToken } });
      toast.success(
        `${summary.sources} sources · ${summary.discovered} found · ${summary.inserted} new · ${summary.duplicates} duplicates`,
      );
      if (summary.errors.length) toast.warning(`${summary.errors.length} source error(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Collection failed");
    } finally {
      setCollecting(false);
      await load();
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
          <div>
            <h1 className="text-base font-semibold">Times Bay Area Command Center</h1>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Collect · filter · review · publish
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={runCollect} disabled={collecting}>
              <RefreshCw className={`size-4 ${collecting ? "animate-spin" : ""}`} aria-hidden="true" />
              {collecting ? "Collecting…" : "Collect now"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                if (window.confirm("Approve and publish every story awaiting a decision?")) void massApprove();
              }}
              disabled={busy}
            >
              <CheckCheck className="size-4" aria-hidden="true" /> Mass approve
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/desk">Picture desk</Link>
            </Button>

            <Button size="sm" variant="ghost" onClick={onLock}>
              Lock
            </Button>
          </div>
        </div>
        <div className="mx-auto grid max-w-6xl grid-cols-3 gap-2 px-4 pb-3 sm:grid-cols-7">
          <Metric label="Collected 24h" value={counters.collected} />
          <Metric label="Duplicates" value={counters.duplicates} />
          <Metric label="Recommended" value={counters.recommended} />
          <Metric label="Needs review" value={counters.needsReview} />
          <Metric label="Approved" value={counters.approved} />
          <Metric label="Published" value={counters.published} />
          <Metric label="Source errors" value={counters.sourceErrors} tone="warn" />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={tab === "queue" ? "default" : "outline"} onClick={() => setTab("queue")}>
            <Sparkles className="size-4" aria-hidden="true" /> Review queue
          </Button>
          <Button size="sm" variant={tab === "sources" ? "default" : "outline"} onClick={() => setTab("sources")}>
            <Rss className="size-4" aria-hidden="true" /> Source registry ({sources.length})
          </Button>
          {tab === "queue" && (
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="ml-auto w-44" aria-label="Filter queue">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Awaiting decision</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="recommended">Recommended</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {tab === "queue" ? (
          <QueueList
            rows={rows}
            busy={busy}
            selected={selected}
            setSelected={setSelected}
            onAct={act}
            onDislike={dislike}
          />

        ) : (
          <SourceRegistry
            sources={sources}
            onSave={async (source) => {
              const res = await persistSource({ data: { deskToken, source } });
              if (res.error) toast.error(res.error);
              else toast.success("Source saved");
              await load();
            }}
            onToggle={async (id, active) => {
              await toggleSource({ data: { deskToken, id, active } });
              await load();
            }}
            onDelete={async (id) => {
              await removeSource({ data: { deskToken, id } });
              await load();
            }}
          />
        )}
      </main>

      {tab === "queue" && selectedIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">{selectedIds.length} selected</span>
            <Button size="sm" className="ml-auto" onClick={() => act("publish", selectedIds)}>
              <ThumbsUp className="size-4" aria-hidden="true" /> Like — approve &amp; publish
            </Button>
            <Button size="sm" variant="outline" onClick={() => act("approve", selectedIds)}>
              Approve only
            </Button>
            <Button size="sm" variant="outline" onClick={() => act("duplicate", selectedIds, "Duplicate")}>
              <CopyX className="size-4" aria-hidden="true" /> Duplicate
            </Button>
            <Button size="sm" variant="outline" onClick={() => act("reject", selectedIds, "Not useful")}>
              <X className="size-4" aria-hidden="true" /> Reject
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (window.confirm(`Permanently delete ${selectedIds.length} item(s) site-wide?`))
                  void dislike(selectedIds);
              }}
            >
              <ThumbsDown className="size-4" aria-hidden="true" /> Dislike — delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function QueueList({
  rows,
  busy,
  selected,
  setSelected,
  onAct,
  onDislike,
}: {
  rows: QueueRow[];
  busy: boolean;
  selected: Set<string>;
  setSelected: (next: Set<string>) => void;
  onAct: (
    action: "approve" | "reject" | "publish" | "duplicate" | "recommend",
    ids: string[],
    reason?: string,
  ) => void;
  onDislike: (ids: string[]) => void;
}) {
  if (busy && !rows.length)
    return <p className="mt-6 text-sm text-muted-foreground">Loading candidates…</p>;
  if (!rows.length)
    return (
      <Card className="mt-4 p-8 text-center text-sm text-muted-foreground">
        Nothing waiting. Run “Collect now” or widen the filter.
      </Card>
    );

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));

  return (
    <>
      <div className="mt-4 flex items-center gap-2 border-y border-border py-2">
        <Checkbox
          checked={allSelected}
          onCheckedChange={(checked) => setSelected(checked ? new Set(rows.map((row) => row.id)) : new Set())}
          aria-label="Select all stories shown"
        />
        <span className="text-xs text-muted-foreground">
          {allSelected ? "All shown selected" : `Select all ${rows.length} shown`}
        </span>
        <Button size="sm" className="ml-auto" onClick={() => onAct("publish", rows.map((row) => row.id))}>
          <CheckCheck className="size-4" aria-hidden="true" /> Approve &amp; publish all shown
        </Button>
      </div>
      <ul className="mt-4 space-y-3">

      {rows.map((row) => (
        <li key={row.id}>
          <Card className="gap-3 p-3">
            <div className="flex items-start gap-3">
              <Checkbox
                checked={selected.has(row.id)}
                onCheckedChange={() => toggle(row.id)}
                aria-label={`Select ${row.original_title}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <Badge variant="secondary" className="rounded-full">
                    {row.city ?? "Bay Area"} · {row.topic ?? "community"}
                  </Badge>
                  <Badge variant="outline" className="rounded-full">
                    {row.source_name}
                  </Badge>
                  <Badge variant="outline" className="rounded-full">
                    <Activity className="size-3" aria-hidden="true" /> {Math.round(row.priority_score)}
                  </Badge>
                  {row.dedupe_status !== "unique" && (
                    <Badge variant="outline" className="rounded-full text-amber-600">
                      <AlertTriangle className="size-3" aria-hidden="true" /> possible duplicate
                    </Badge>
                  )}
                  {row.requires_human_review && (
                    <Badge variant="outline" className="rounded-full">
                      human review
                    </Badge>
                  )}
                </div>
                <h2 className="mt-1 text-sm font-semibold text-card-foreground">
                  {row.digest_headline || row.original_title}
                </h2>
                {row.excerpt && (
                  <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{row.excerpt}</p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <a
                    href={row.canonical_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline"
                  >
                    <ExternalLink className="size-3" aria-hidden="true" /> Read original
                  </a>
                  {row.publication_datetime && (
                    <span>{new Date(row.publication_datetime).toLocaleString()}</span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => onAct("publish", [row.id])}>
                    <ThumbsUp className="size-4" aria-hidden="true" /> Like — approve &amp; publish
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onAct("approve", [row.id])}>
                    <Check className="size-4" aria-hidden="true" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (window.confirm("Permanently delete this story site-wide?")) onDislike([row.id]);
                    }}
                  >
                    <ThumbsDown className="size-4" aria-hidden="true" /> Dislike — delete
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAct("duplicate", [row.id], "Duplicate")}
                  >
                    <CopyX className="size-4" aria-hidden="true" /> Duplicate
                  </Button>
                  <Select onValueChange={(reason) => onAct("reject", [row.id], reason)}>
                    <SelectTrigger className="h-8 w-40 text-xs" aria-label="Reject with reason">
                      <SelectValue placeholder="Reject…" />
                    </SelectTrigger>
                    <SelectContent>
                      {REJECT_REASONS.map((reason) => (
                        <SelectItem key={reason} value={reason}>
                          {reason}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {row.image_url && (
                <img
                  src={row.image_url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="hidden size-24 rounded-md border border-border object-cover sm:block"
                />
              )}
            </div>
          </Card>
        </li>
      ))}
      </ul>
    </>

  );
}

const EMPTY_SOURCE: SourceInput = {
  name: "",
  source_url: "",
  rss_url: "",
  source_class: "community",
  connector_type: "direct_rss",
  confidence: "medium",
  cities: [],
  topics: [],
  frequency_minutes: 180,
  active: true,
};

function SourceRegistry({
  sources,
  onSave,
  onToggle,
  onDelete,
}: {
  sources: SourceRow[];
  onSave: (source: SourceInput) => Promise<void>;
  onToggle: (id: string, active: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<SourceInput>(EMPTY_SOURCE);
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {sources.filter((s) => s.active).length} active · {sources.filter((s) => s.status === "error").length} errored
        </p>
        <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
          <Plus className="size-4" aria-hidden="true" /> Add source
        </Button>
      </div>

      {open && (
        <Card className="gap-2 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Source name"
              aria-label="Source name"
            />
            <Input
              value={draft.rss_url ?? ""}
              onChange={(e) => setDraft({ ...draft, rss_url: e.target.value })}
              placeholder="RSS or API URL"
              aria-label="Feed URL"
            />
            <Input
              value={draft.cities.join(",")}
              onChange={(e) =>
                setDraft({ ...draft, cities: e.target.value.split(",").map((c) => c.trim()).filter(Boolean) })
              }
              placeholder="cities (fremont,milpitas)"
              aria-label="Cities"
            />
            <Input
              value={draft.topics.join(",")}
              onChange={(e) =>
                setDraft({ ...draft, topics: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })
              }
              placeholder="topics (transportation,events)"
              aria-label="Topics"
            />
            <Select
              value={draft.source_class}
              onValueChange={(v) => setDraft({ ...draft, source_class: v })}
            >
              <SelectTrigger aria-label="Source class">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_CLASSES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={draft.connector_type}
              onValueChange={(v) => setDraft({ ...draft, connector_type: v })}
            >
              <SelectTrigger aria-label="Connector">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONNECTORS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={draft.confidence} onValueChange={(v) => setDraft({ ...draft, confidence: v })}>
              <SelectTrigger aria-label="Confidence">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONFIDENCE.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={async () => {
                await onSave(draft);
                setDraft(EMPTY_SOURCE);
                setOpen(false);
              }}
              disabled={!draft.name.trim()}
            >
              Save source
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <ul className="space-y-2">
        {sources.map((s) => (
          <li key={s.id}>
            <Card className="gap-1 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{s.name}</span>
                <Badge variant="secondary" className="rounded-full text-[11px]">
                  {s.source_class}
                </Badge>
                <Badge variant="outline" className="rounded-full text-[11px]">
                  {s.connector_type}
                </Badge>
                <Badge
                  variant="outline"
                  className={`rounded-full text-[11px] ${
                    s.status === "error" ? "text-destructive" : s.status === "inactive" ? "" : "text-primary"
                  }`}
                >
                  {s.status}
                </Badge>
                <div className="ml-auto flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => onToggle(s.id, !s.active)}>
                    {s.active ? "Pause" : "Activate"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDelete(s.id)}>
                    <X className="size-4" aria-hidden="true" />
                    <span className="sr-only">Delete source</span>
                  </Button>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {s.cities.join(", ") || "all cities"} · {s.topics.join(", ") || "all topics"} · every{" "}
                {s.frequency_minutes} min
              </p>
              <p className="text-[11px] text-muted-foreground">
                {s.items_discovered} discovered · {s.items_published} published · {s.duplicates_removed} duplicates ·{" "}
                {s.last_success_at
                  ? `last ok ${new Date(s.last_success_at).toLocaleString()}`
                  : "never collected"}
              </p>
              {s.last_error && <p className="text-[11px] text-destructive">{s.last_error}</p>}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
