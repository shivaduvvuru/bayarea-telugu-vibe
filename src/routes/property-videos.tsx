import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BarChart3, Check, Lock, RefreshCw, Trash2, X } from "lucide-react";
import { checkDesk, lockDesk, unlockDesk } from "@/lib/desk-gate.functions";
import {
  deletePropertyVideo,
  listPropertyVideos,
  savePropertyVideo,
  setPropertyVideoStatus,
} from "@/lib/property-videos.functions";
import {
  parseYouTubeId,
  youtubeThumbnail,
  youtubeWatchUrl,
  type PropertyVideoWithStats,
} from "@/lib/property-videos";
import { PROPERTY_FEATURES } from "@/lib/property-showcase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/property-videos")({
  head: () => ({
    meta: [
      { title: "Property video desk — Times Bay Area" },
      {
        name: "description",
        content:
          "Editorial desk to add, edit and verify short video tours for Hyderabad property projects before they go live.",
      },
      { property: "og:title", content: "Property video desk — Times Bay Area" },
      { property: "og:description", content: "Add, verify and measure property video tours." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PropertyVideoDeskPage,
});

function PropertyVideoDeskPage() {
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
        <p className="text-sm text-muted-foreground">Loading video desk…</p>
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
          <h1 className="text-lg font-semibold">Property video desk</h1>
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

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending review",
  verified: "Verified — live",
  rejected: "Rejected",
};

function Workspace({ deskToken, onLock }: { deskToken: string; onLock: () => Promise<void> }) {
  const [rows, setRows] = useState<PropertyVideoWithStats[]>([]);
  const [busy, setBusy] = useState(false);
  const [featureId, setFeatureId] = useState(PROPERTY_FEATURES[0]?.id ?? "");
  const [videoInput, setVideoInput] = useState("");
  const [note, setNote] = useState("");

  const load = useServerFn(listPropertyVideos);
  const save = useServerFn(savePropertyVideo);
  const setStatus = useServerFn(setPropertyVideoStatus);
  const remove = useServerFn(deletePropertyVideo);

  const refresh = useCallback(async () => {
    setBusy(true);
    const res = await load({ data: { deskToken } }).catch(() => null);
    setRows(res?.videos ?? []);
    setBusy(false);
  }, [load, deskToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const byFeature = useMemo(
    () => new Map(rows.map((r) => [r.feature_id, r])),
    [rows],
  );
  const totals = useMemo(
    () => ({
      verified: rows.filter((r) => r.status === "verified").length,
      pending: rows.filter((r) => r.status === "pending").length,
      clicks: rows.reduce((n, r) => n + r.clicks, 0),
    }),
    [rows],
  );
  const topClicked = useMemo(
    () => [...rows].sort((a, b) => b.clicks - a.clicks).slice(0, 8),
    [rows],
  );

  const feature = PROPERTY_FEATURES.find((f) => f.id === featureId);
  const parsed = parseYouTubeId(videoInput);

  async function submit(status: "pending" | "verified") {
    if (!feature) return;
    if (!parsed) {
      toast.error("Paste a valid YouTube link or 11-character video id.");
      return;
    }
    setBusy(true);
    const res = await save({
      data: {
        deskToken,
        featureId: feature.id,
        project: feature.project,
        developer: feature.developer,
        videoId: parsed,
        ...(note.trim() ? { note: note.trim() } : {}),
        status,
      },
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      toast.error("Could not save that video.");
      return;
    }
    toast.success(status === "verified" ? "Video verified and live." : "Video saved for review.");
    setVideoInput("");
    setNote("");
    await refresh();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-ink">Property video desk</h1>
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
        Only verified clips appear on the{" "}
        <Link to="/property" className="font-bold text-primary">
          public property page
        </Link>
        .
      </p>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Metric label="Verified" value={totals.verified} />
        <Metric label="Pending" value={totals.pending} />
        <Metric label="Thumbnail plays" value={totals.clicks} />
      </div>

      <Card className="mt-5 space-y-3 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Add or edit a video tour
        </h2>
        <label className="block text-xs font-semibold text-ink">
          Project
          <select
            value={featureId}
            onChange={(e) => {
              setFeatureId(e.target.value);
              const existing = byFeature.get(e.target.value);
              setVideoInput(existing?.video_id ?? "");
              setNote(existing?.note ?? "");
            }}
            className="mt-1 block h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            {PROPERTY_FEATURES.map((f) => {
              const row = byFeature.get(f.id);
              return (
                <option key={f.id} value={f.id}>
                  {f.project} — {f.developer}
                  {row ? ` · ${STATUS_LABEL[row.status]}` : f.videoId ? " · edition clip" : ""}
                </option>
              );
            })}
          </select>
        </label>
        <label className="block text-xs font-semibold text-ink">
          YouTube link or id
          <Input
            value={videoInput}
            onChange={(e) => setVideoInput(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
            className="mt-1"
          />
        </label>
        <label className="block text-xs font-semibold text-ink">
          Desk note (optional)
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Checked: official developer upload, 2026"
            className="mt-1"
          />
        </label>

        {parsed ? (
          <div className="flex gap-3">
            <img
              src={youtubeThumbnail(parsed)}
              alt="Video preview"
              className="h-20 w-36 rounded-md border border-border object-cover"
            />
            <div className="text-xs text-muted-foreground">
              <p className="font-semibold text-ink">Preview before verifying</p>
              <a
                href={youtubeWatchUrl(parsed)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary hover:underline"
              >
                Watch on YouTube
              </a>
            </div>
          </div>
        ) : videoInput.trim() ? (
          <p className="text-xs text-destructive">That is not a recognisable YouTube video.</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy || !parsed} onClick={() => void submit("verified")}>
            <Check className="mr-1 size-4" aria-hidden /> Save &amp; verify
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !parsed}
            onClick={() => void submit("pending")}
          >
            Save for review
          </Button>
        </div>
      </Card>

      <section className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Videos on file
        </h2>
        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {busy ? "Loading…" : "No videos added yet."}
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {rows.map((r) => (
              <li
                key={r.feature_id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-2"
              >
                <img
                  src={youtubeThumbnail(r.video_id)}
                  alt=""
                  className="h-14 w-24 rounded object-cover"
                />
                <div className="min-w-40 flex-1">
                  <p className="text-sm font-bold text-ink">{r.project}</p>
                  <p className="text-xs text-muted-foreground">
                    {STATUS_LABEL[r.status]} · {r.clicks} {r.clicks === 1 ? "play" : "plays"}
                    {r.note ? ` · ${r.note}` : ""}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {r.status !== "verified" ? (
                    <Button
                      size="sm"
                      onClick={async () => {
                        await setStatus({
                          data: { deskToken, featureId: r.feature_id, status: "verified" },
                        });
                        await refresh();
                      }}
                    >
                      <Check className="size-4" aria-hidden />
                      <span className="sr-only">Verify</span>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await setStatus({
                          data: { deskToken, featureId: r.feature_id, status: "rejected" },
                        });
                        await refresh();
                      }}
                    >
                      <X className="size-4" aria-hidden />
                      <span className="sr-only">Unpublish</span>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await remove({ data: { deskToken, featureId: r.feature_id } });
                      await refresh();
                    }}
                  >
                    <Trash2 className="size-4 text-destructive" aria-hidden />
                    <span className="sr-only">Delete</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          <BarChart3 className="size-4" aria-hidden /> Most-played tours
        </h2>
        {topClicked.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No plays recorded yet.</p>
        ) : (
          <ol className="mt-2 space-y-1">
            {topClicked.map((r, i) => (
              <li key={r.feature_id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-ink">
                  {i + 1}. {r.project}
                </span>
                <span className="font-bold text-primary">{r.clicks}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-xl font-bold text-ink">{value}</p>
    </Card>
  );
}
