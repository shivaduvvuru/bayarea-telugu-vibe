import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Run = {
  mode: string;
  trigger: string;
  collected: number;
  published: number;
  held: number;
  duplicates_hidden: number;
  ok: boolean;
  error: string | null;
  finished_at: string;
};

export const collectStatusKey = (mode: "all" | "gallery") => ["collect-status", mode];

/** Reads the latest logged collection run for a mode ("gallery" or "all"). */
export function useCollectStatus(mode: "all" | "gallery") {
  return useQuery({
    queryKey: collectStatusKey(mode),
    staleTime: 60_000,
    queryFn: async (): Promise<Run | null> => {
      const { data } = await supabase
        .from("collect_runs")
        .select("mode, trigger, collected, published, held, duplicates_hidden, ok, error, finished_at")
        .eq("mode", mode)
        .order("finished_at", { ascending: false })
        .limit(1);
      return ((data ?? [])[0] as Run | undefined) ?? null;
    },
  });
}

function ago(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

/**
 * Small "last pull" chip: shows when the scheduled job (gallery: every 30 min,
 * news: hourly) or a manual
 * refresh last finished and how many items it added.
 */
export function CollectStatus({
  mode,
  busy = false,
  className = "",
}: {
  mode: "all" | "gallery";
  /** True while a manual refresh is running. */
  busy?: boolean;
  className?: string;
}) {
  const { data: run, isLoading } = useCollectStatus(mode);
  const cadence = mode === "gallery" ? "every 30 minutes" : "every hour";
  const cadenceShort = mode === "gallery" ? "every 30 min" : "hourly";

  const base = `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${className}`;

  if (busy)
    return (
      <span className={`${base} border-border text-muted-foreground`} aria-live="polite">
        <Clock className="h-3 w-3 animate-pulse" aria-hidden />
        Pulling new items…
      </span>
    );

  if (isLoading)
    return (
      <span className={`${base} border-border text-muted-foreground`}>
        <Clock className="h-3 w-3" aria-hidden />
        Checking last pull…
      </span>
    );

  if (!run)
    return (
      <span className={`${base} border-border text-muted-foreground`}>
        <Clock className="h-3 w-3" aria-hidden />
        No pull recorded yet · runs {cadence}
      </span>
    );

  if (!run.ok)
    return (
      <span className={`${base} border-destructive/40 text-destructive`} title={run.error ?? ""}>
        <AlertTriangle className="h-3 w-3" aria-hidden />
        Last pull failed {ago(run.finished_at)} · retries {cadence}
      </span>
    );

  const added = run.published || run.collected;

  return (
    <span
      className={`${base} border-border text-muted-foreground`}
      title={`${run.trigger === "manual" ? "Manual refresh" : "Scheduled job (${cadence})"} finished ${new Date(run.finished_at).toLocaleString()} · ${run.collected} collected, ${run.published} published, ${run.held} held for review, ${run.duplicates_hidden} duplicates removed`}
    >
      <CheckCircle2 className="h-3 w-3 text-primary" aria-hidden />
      Updated {ago(run.finished_at)} · {added} item{added === 1 ? "" : "s"}
      <span className="hidden sm:inline">  · {cadenceShort}</span>
    </span>
  );
}
