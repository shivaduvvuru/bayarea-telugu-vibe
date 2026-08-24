/**
 * Pushover alerting.
 *
 * Credentials live in project secrets (PUSHOVER_APP_TOKEN / PUSHOVER_USER_KEY)
 * and are read inside the send call, never at module scope. Every API response
 * is logged, and a non-200 is written to `ingest_runs` so a broken alert
 * channel is itself visible on /admin/health.
 */
import { logIngestRuns } from "./ingest-runs.server";

export const MAX_BODY = 1000;

export async function sendPushover(opts: {
  title: string;
  message: string;
  priority?: 0 | 1;
  url?: string;
  urlTitle?: string;
}): Promise<{ ok: boolean; status: number; body: string }> {
  const token = process.env["PUSHOVER_APP_TOKEN"];
  const user = process.env["PUSHOVER_USER_KEY"];
  if (!token || !user) {
    const error = "Pushover credentials missing";
    console.error(error);
    await logIngestRuns([
      { run_id: crypto.randomUUID(), mode: "pushover", source: "pushover", status: "failed", error },
    ]);
    return { ok: false, status: 0, body: error };
  }

  const form = new URLSearchParams({
    token,
    user,
    title: opts.title.slice(0, 250),
    message: opts.message.slice(0, MAX_BODY),
    priority: String(opts.priority ?? 0),
    url: opts.url ?? "https://timesbayarea.com/admin/health",
    url_title: opts.urlTitle ?? "Open ingest health",
  });

  let status = 0;
  let body = "";
  try {
    const res = await fetch("https://api.pushover.net/1/messages.json", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: AbortSignal.timeout(15_000),
    });
    status = res.status;
    body = (await res.text()).slice(0, 500);
  } catch (err) {
    body = err instanceof Error ? err.message : String(err);
  }

  console.log(`Pushover ${opts.title}: HTTP ${status} ${body}`);
  const ok = status === 200;
  await logIngestRuns([
    {
      run_id: crypto.randomUUID(),
      mode: "pushover",
      source: `pushover:${opts.title}`,
      status: ok ? "ok" : "failed",
      items_inserted: ok ? 1 : 0,
      error: ok ? null : `HTTP ${status}: ${body}`,
    },
  ]);
  return { ok, status, body };
}
