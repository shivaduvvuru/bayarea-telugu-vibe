import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { publishApproved as publishApprovedFn } from "@/lib/desk-publish.functions";
import { listQueueRows, setQueueStatus } from "@/lib/desk-queue.functions";
import type { ItemStatus, UploadState } from "./desk";

export type QueueRow = {
  item_id: string;
  status: ItemStatus;
  upload_status: UploadState;
  uploaded_at: string | null;
  error: string | null;
};

/**
 * Review queue for the editorial desk, backed by the digest_queue table.
 * Decisions live in the database so any editor sees the same state.
 */
export function useReviewQueue(itemIds: string[], version: string) {
  const [rows, setRows] = useState<Record<string, QueueRow>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const publishApproved = useServerFn(publishApprovedFn);
  const fetchRows = useServerFn(listQueueRows);
  const saveStatus = useServerFn(setQueueStatus);

  const load = useCallback(async () => {
    if (!itemIds.length) {
      setRows({});
      return {} as Record<string, QueueRow>;
    }
    const data = await fetchRows({ data: { itemIds } });
    const map: Record<string, QueueRow> = {};
    (data ?? []).forEach((r) => (map[r.item_id] = r as QueueRow));
    setRows(map);
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
      } catch (e) {
        console.error("desk queue load failed", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const setStatus = useCallback(
    async (ids: string[], status: ItemStatus) => {
      if (!ids.length) return;
      setRows((prev) => {
        const next = { ...prev };
        ids.forEach((id) => {
          const cur = next[id];
          next[id] = cur
            ? { ...cur, status }
            : { item_id: id, status, upload_status: "none", uploaded_at: null, error: null };
        });
        return next;
      });
      try {
        await saveStatus({ data: { itemIds: ids, status } });
      } catch (e) {
        console.error(e);
        await load();
        throw e;
      }
      // Approving is publishing: push straight into the newsroom so readers
      // see every approved story without a second manual step.
      if (status === "approved") {
        try {
          const res = await publishApproved({ data: { itemIds: ids } });
          if (res.error) console.error("auto-publish failed", res.error);
        } catch (e) {
          console.error("auto-publish failed", e);
        }
      }
      await load();
    },
    [load, publishApproved, saveStatus],
  );

  /** Safety net: push every approved-but-unpublished item into the newsroom. */
  const processQueue = useCallback(async () => {
    setBusy(true);
    try {
      const res = await publishApproved({ data: {} });
      await load();
      if (res.error) throw new Error(res.error);
      return res.sent;
    } finally {
      setBusy(false);
    }
  }, [load, publishApproved]);


  const statusOf = (id: string): ItemStatus => rows[id]?.status ?? "pending";
  const uploadOf = (id: string): UploadState => rows[id]?.upload_status ?? "none";

  const uploadCounts = {
    sent: Object.values(rows).filter((r) => r.upload_status === "sent").length,
    failed: Object.values(rows).filter((r) => r.upload_status === "failed").length,
    ready: Object.values(rows).filter(
      (r) => r.status === "approved" && r.upload_status !== "sent",
    ).length,
  };

  return { rows, loading, busy, statusOf, uploadOf, setStatus, processQueue, uploadCounts };
}
