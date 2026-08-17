/**
 * Supabase/PostgREST failures are plain objects, so String(e) collapses them to
 * "[object Object]" and the real cause is lost in the run log. This keeps the
 * message, code, details and hint readable.
 */
export function errorMessage(e: unknown): string {
  if (!e) return "unknown error";
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (typeof e === "object") {
    const o = e as Record<string, unknown>;
    const parts = ["message", "code", "details", "hint"]
      .map((k) => (o[k] ? `${k}: ${String(o[k])}` : ""))
      .filter(Boolean);
    if (parts.length) return parts.join(" | ");
    try {
      return JSON.stringify(e).slice(0, 800);
    } catch {
      return "unserializable error";
    }
  }
  return String(e);
}
