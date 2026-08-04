import { useCallback, useEffect, useState } from "react";
import { track } from "@/lib/analytics";

const KEY = "batt-saved";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/** Local "save for later" list — no account required. */
export function useSaved(id: string) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(read().includes(id));
  }, [id]);

  const toggle = useCallback(() => {
    const list = read();
    const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    window.localStorage.setItem(KEY, JSON.stringify(next));
    setSaved(next.includes(id));
    track("save", { id, saved: next.includes(id) });
  }, [id]);

  return { saved, toggle };
}

export async function shareLink(url: string, title: string, context: string) {
  track("share", { url, context });
  const absolute = url.startsWith("http")
    ? url
    : `${typeof window !== "undefined" ? window.location.origin : ""}${url}`;
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, url: absolute });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  await navigator.clipboard?.writeText(absolute);
  return "copied";
}

export function whatsappUrl(url: string, title: string) {
  return `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`;
}