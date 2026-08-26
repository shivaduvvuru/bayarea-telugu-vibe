import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { markGlamourShown } from "./glamour-shown.functions";

/**
 * Stamps the Glamour pictures on screen as shown, so tomorrow's rotation puts
 * them behind the ones nobody has seen. Each slug is reported once per session.
 */
export function useGlamourShown(slugs: string[], enabled = true) {
  const mark = useServerFn(markGlamourShown);
  const reported = useRef<Set<string>>(new Set());
  const key = slugs.join(",");

  useEffect(() => {
    if (!enabled) return;
    const fresh = slugs.filter((s) => s && !reported.current.has(s));
    if (!fresh.length) return;
    for (const s of fresh) reported.current.add(s);
    const timer = window.setTimeout(() => {
      void mark({ data: { slugs: fresh } }).catch(() => {});
    }, 1500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
}
