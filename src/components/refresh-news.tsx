import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ArrowDown } from "lucide-react";
import { toast } from "sonner";

/**
 * News freshness controls for the fast-moving desks (City News, India,
 * Cinema/OTT and Micro-Drama).
 *
 * The scheduled collector keeps the store fresh in the background; these
 * controls only re-read it: a manual "Refresh news" button, a pull-to-refresh
 * gesture on touch screens, and a "Last updated X ago" stamp so readers can
 * see how recent the section is.
 */

/** Poll cadence per desk: local/national news turns over faster than cinema. */
export function newsRefreshMs(category: string) {
  if (category === "cinema" || category === "micro-drama" || category === "gallery") {
    return 30 * 60 * 1000;
  }
  return 15 * 60 * 1000;
}

function ago(at: number) {
  const mins = Math.max(0, Math.round((Date.now() - at) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins > 1 ? "s" : ""} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  return `${Math.round(hrs / 24)} day${hrs >= 48 ? "s" : ""} ago`;
}

/** Re-reads the given query keys and reports the outcome. */
function useNewsRefresh(queryKeys: unknown[][]) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const run = async (quiet = false) => {
    if (busy) return;
    setBusy(true);
    try {
      // Nudge the collector too — harmless when it is locked or already running.
      void fetch("/api/public/hooks/collect-news", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "manual" }),
      }).catch(() => undefined);
      await Promise.all(
        queryKeys.map((queryKey) => qc.refetchQueries({ queryKey, type: "active" })),
      );
      if (!quiet) toast.success("News refreshed");
    } catch {
      if (!quiet) toast.error("Could not refresh right now");
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

/** Header row: manual refresh button plus the last-updated stamp. */
export function NewsFreshness({
  queryKeys,
  updatedAt,
  className = "",
}: {
  queryKeys: unknown[][];
  /** react-query dataUpdatedAt for the section's primary query. */
  updatedAt?: number;
  className?: string;
}) {
  const { busy, run } = useNewsRefresh(queryKeys);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold text-ink transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} aria-hidden />
        {busy ? "Refreshing…" : "Refresh news"}
      </button>
      {updatedAt ? (
        <span className="text-xs text-muted-foreground" aria-live="polite">
          Last updated {ago(updatedAt)}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Pull-to-refresh for touch screens: drag down at the top of the page to
 * re-read the section. Renders a small hint band while the gesture is active.
 */
export function PullToRefresh({ queryKeys }: { queryKeys: unknown[][] }) {
  const { busy, run } = useNewsRefresh(queryKeys);
  const [pull, setPull] = useState(0);
  const start = useRef<number | null>(null);

  useEffect(() => {
    const THRESHOLD = 70;
    const onStart = (e: TouchEvent) => {
      start.current = window.scrollY <= 0 ? (e.touches[0]?.clientY ?? null) : null;
    };
    const onMove = (e: TouchEvent) => {
      if (start.current === null) return;
      const dy = (e.touches[0]?.clientY ?? 0) - start.current;
      setPull(dy > 0 ? Math.min(dy, 120) : 0);
    };
    const onEnd = () => {
      if (pull >= THRESHOLD) void run(false);
      start.current = null;
      setPull(0);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [pull, run]);

  if (!busy && pull === 0) return null;
  return (
    <div
      className="flex items-center justify-center gap-2 overflow-hidden text-xs font-semibold text-muted-foreground transition-[height]"
      style={{ height: busy ? 32 : Math.min(pull, 60) }}
    >
      {busy ? (
        <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <ArrowDown className="h-3.5 w-3.5" aria-hidden />
      )}
      {busy ? "Refreshing news…" : pull >= 70 ? "Release to refresh" : "Pull to refresh"}
    </div>
  );
}
