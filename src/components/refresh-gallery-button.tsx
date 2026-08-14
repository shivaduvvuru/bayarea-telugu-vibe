import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { CollectStatus, collectStatusKey } from "@/components/collect-status";

/**
 * Forces an immediate gallery-only collection pass, then reloads the picture
 * tiles so newly collected star photos appear without waiting for the
 * 3-hourly job or the query cache.
 */
export function RefreshGalleryButton({
  className = "",
  onRefreshed,
}: {
  className?: string;
  /** Lets a grid advance its rotating window so the tiles visibly change. */
  onRefreshed?: (added: number) => void;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/public/hooks/collect-news", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string,
        },
        body: JSON.stringify({ mode: "gallery", trigger: "manual" }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        collected?: number;
        published?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Refresh failed");
      await qc.invalidateQueries({ queryKey: ["wp", "posts", "gallery"] });
      await qc.refetchQueries({ queryKey: ["wp", "posts", "gallery"] });
      await qc.invalidateQueries({ queryKey: collectStatusKey("gallery") });
      const added = json.published ?? json.collected ?? 0;
      onRefreshed?.(added);
      toast.success(
        added
          ? `${added} new pictures added`
          : "No new photos from the sources yet — showing more from the archive",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not refresh the gallery");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold text-ink transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} aria-hidden />
        {busy ? "Refreshing…" : "Refresh gallery"}
      </button>
      <CollectStatus mode="gallery" busy={busy} />
    </span>
  );
}
