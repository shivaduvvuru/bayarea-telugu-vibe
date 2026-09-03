/**
 * Temple Calendar ingestion (server only).
 *
 * Reads publicly published temple programs, in this priority order:
 *   1. public ICS / iCal feed
 *   2. RSS / Atom feed
 *   3. public Google Calendar (ICS export)
 *   4. structured events page HTML
 *   5. temple homepage / announcements HTML
 *
 * Only public program information is read. No authentication, CAPTCHA or
 * access control is ever bypassed, and nothing is published without passing
 * validation — uncertain rows land in `needs_review`.
 */
import { TEMPLES } from "@/lib/temple-directory";
import {
  classifyLevel,
  detectDeities,
  detectEventGroup,
  type TempleEventLevel,
} from "@/lib/temple-calendar";

const TIMEOUT_MS = 9000;
const UA = "TimesBayArea/1.0 (+https://timesbayarea.com)";

type SourceRow = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  region: string | null;
  website: string | null;
  events_url: string | null;
  rss_url: string | null;
  ics_url: string | null;
  gcal_url: string | null;
  deities: string[];
  active: boolean;
  auto_import: boolean;
  fail_count: number;
};

type ParsedEvent = {
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
  description: string | null;
  url: string | null;
  uid: string | null;
  recurrence: string | null;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // The temple tables are newer than the generated types.
  return supabaseAdmin as unknown as {
    from: (t: string) => any;
  };
}

/* ------------------------------- registry -------------------------------- */

/** Seeds/refreshes temple_sources from the verified newsroom directory. */
export async function syncTempleSources(): Promise<number> {
  const db = await admin();
  const rows = TEMPLES.map((t) => ({
    slug: t.slug,
    name: t.name,
    website: t.website,
    city: t.city ?? t.nearby_city,
    region: t.region,
    address: t.address,
    latitude: t.latitude,
    longitude: t.longitude,
    deities: t.deities,
    temple_type: t.temple_type,
    traditions: t.traditions,
    events_url: t.event_source ?? t.website,
  }));
  const { error } = await db
    .from("temple_sources")
    .upsert(rows, { onConflict: "slug", ignoreDuplicates: false });
  if (error) throw new Error(error.message);
  return rows.length;
}

/* -------------------------------- parsing -------------------------------- */

function decode(s: string) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;|&rsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&#8211;|&ndash;|&mdash;/g, "-")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(s: string) {
  return decode(s.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " "));
}

async function get(url: string, accept: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: accept },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Unfolds RFC 5545 line continuations. */
function icsLines(body: string): string[] {
  return body.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function icsDate(value: string, param: string): { date: Date | null; allDay: boolean } {
  const dateOnly = /VALUE=DATE/i.test(param) || /^\d{8}$/.test(value.trim());
  const v = value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) {
    const d = new Date(v);
    return { date: Number.isNaN(d.getTime()) ? null : d, allDay: dateOnly };
  }
  const [, y, mo, d, hh, mi, ss, z] = m;
  const iso = `${y}-${mo}-${d}T${hh ?? "00"}:${mi ?? "00"}:${ss ?? "00"}${z ? "Z" : "-07:00"}`;
  const parsed = new Date(iso);
  return { date: Number.isNaN(parsed.getTime()) ? null : parsed, allDay: dateOnly };
}

function parseIcs(body: string, pageUrl: string): ParsedEvent[] {
  if (!/BEGIN:VEVENT/i.test(body)) return [];
  const out: ParsedEvent[] = [];
  let cur: Record<string, { value: string; param: string }> | null = null;
  for (const line of icsLines(body)) {
    if (/^BEGIN:VEVENT/i.test(line)) cur = {};
    else if (/^END:VEVENT/i.test(line)) {
      if (cur) {
        const start = cur["DTSTART"] ? icsDate(cur["DTSTART"].value, cur["DTSTART"].param) : null;
        const end = cur["DTEND"] ? icsDate(cur["DTEND"].value, cur["DTEND"].param) : null;
        const title = decode(cur["SUMMARY"]?.value ?? "");
        if (title && start?.date) {
          out.push({
            title,
            startsAt: start.date,
            endsAt: end?.date ?? null,
            allDay: start.allDay,
            description: cur["DESCRIPTION"] ? decode(cur["DESCRIPTION"].value).slice(0, 600) : null,
            url: cur["URL"]?.value?.trim() || pageUrl,
            uid: cur["UID"]?.value?.trim() ?? null,
            recurrence: cur["RRULE"]?.value ?? null,
          });
        }
      }
      cur = null;
    } else if (cur) {
      const idx = line.indexOf(":");
      if (idx > 0) {
        const rawKey = line.slice(0, idx);
        const [key, ...params] = rawKey.split(";");
        cur[key!.toUpperCase()] = { value: line.slice(idx + 1), param: params.join(";") };
      }
    }
  }
  return out;
}

/** Dates in prose: "August 23, 2026", "8/23/2026", "2026-08-23", optional time. */
function textDate(text: string, now: Date): { date: Date; allDay: boolean } | null {
  const months =
    "(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)";
  let m =
    text.match(new RegExp(`\\b${months}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(20\\d{2}))?`, "i")) ??
    text.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${months}\\.?(?:,?\\s*(20\\d{2}))?`, "i"));
  let iso: string | null = null;
  if (m) {
    const monthName = /^\d/.test(m[1]!) ? m[2]! : m[1]!;
    const day = /^\d/.test(m[1]!) ? m[1]! : m[2]!;
    const year = m[3] ?? String(now.getFullYear());
    const monthIdx = new Date(`${monthName} 1, 2000`).getMonth();
    if (Number.isNaN(monthIdx)) return null;
    iso = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
  } else if ((m = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/))) {
    iso = `${m[1]}-${m[2]}-${m[3]}`;
  } else if ((m = text.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/))) {
    iso = `${m[3]}-${m[1]!.padStart(2, "0")}-${m[2]!.padStart(2, "0")}`;
  }
  if (!iso) return null;
  const time = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (time) {
    let hour = Number(time[1]);
    if (/pm/i.test(time[3]!) && hour < 12) hour += 12;
    if (/am/i.test(time[3]!) && hour === 12) hour = 0;
    const d = new Date(`${iso}T${String(hour).padStart(2, "0")}:${time[2] ?? "00"}:00-07:00`);
    return Number.isNaN(d.getTime()) ? null : { date: d, allDay: false };
  }
  const d = new Date(`${iso}T00:00:00-07:00`);
  return Number.isNaN(d.getTime()) ? null : { date: d, allDay: true };
}

function parseRss(xml: string, pageUrl: string, now: Date): ParsedEvent[] {
  const out: ParsedEvent[] = [];
  const blocks = xml.split(/<(?:item|entry)[\s>]/i).slice(1);
  for (const block of blocks) {
    const title = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    if (!title) continue;
    const link =
      block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]?.trim() ??
      block.match(/<link[^>]*href="([^"]+)"/i)?.[1] ??
      pageUrl;
    const body = stripTags(
      block.match(/<(?:description|summary|content[^>]*)>([\s\S]*?)<\/(?:description|summary|content)>/i)?.[1] ??
        "",
    );
    const name = stripTags(title[1] ?? "");
    const found = textDate(`${name} ${body}`, now);
    if (!name || !found) continue;
    out.push({
      title: name,
      startsAt: found.date,
      endsAt: null,
      allDay: found.allDay,
      description: body ? body.slice(0, 600) : null,
      url: link,
      uid: null,
      recurrence: null,
    });
  }
  return out;
}

const NOISE =
  /^(home|about( us)?|contact( us)?|donate|donations?|temple( hours| timings)?|events?|upcoming events?|calendar|gallery|photos?|newsletter|volunteer|sponsors?|services?|search|menu|schedule|sign in|login|subscribe)$/i;

/** Headings that are only a date, weekday, month or time carry no program name. */
const DATE_ONLY =
  /^(?:(?:mon|tues?|wed(?:nes)?|thurs?|fri|satur?|sun)(?:day)?|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|\d{1,4}|20\d{2}|[-–,:.@]|am|pm|at|all\s?day|st|nd|rd|th|\d{1,2}[:.]\d{2})+$/i;

/** A real program title has words beyond calendar scaffolding. */
function usableHeading(title: string) {
  if (title.length < 6 || title.length > 140) return false;
  if (NOISE.test(title)) return false;
  const bare = title.replace(/[^\w\s:.@,–-]/g, " ").replace(/\s+/g, " ").trim();
  if (DATE_ONLY.test(bare)) return false;
  // Strip date/time tokens; whatever remains must still read as a name.
  const words = bare
    .split(/\s+/)
    .filter((w) => !DATE_ONLY.test(w) && w.length > 2);
  return words.length >= 1 && words.join(" ").length >= 5;
}

/** Keeps one program per temple page, per day, per normalised title. */
function firstOfDay(seen: Set<string>, title: string, startsAt: Date) {
  const key = `${startsAt.toISOString().slice(0, 10)}|${title
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim()
    .slice(0, 32)}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}


function parseHtml(html: string, pageUrl: string, now: Date): ParsedEvent[] {

  const out: ParsedEvent[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/<h[1-5][^>]*>([\s\S]*?)<\/h[1-5]>/gi)) {
    const title = stripTags(m[1] ?? "");
    if (!title || !usableHeading(title)) continue;

    const idx = (m.index ?? 0) + m[0].length;
    const near = stripTags(html.slice(idx, idx + 500));
    const found = textDate(`${title} ${near}`, now);
    if (!found) continue;
    if (!firstOfDay(seen, title, found.date)) continue;
    out.push({
      title,
      startsAt: found.date,
      endsAt: null,
      allDay: found.allDay,
      description: near.slice(0, 300) || null,
      url: pageUrl,
      uid: null,
      recurrence: null,
    });
  }
  // Common list markup: <li>/<td> rows carrying "date — program".
  if (out.length === 0) {
    for (const m of html.matchAll(/<(?:li|td|p)[^>]*>([\s\S]{10,400}?)<\/(?:li|td|p)>/gi)) {
      const text = stripTags(m[1] ?? "");
      if (!text || text.length < 12 || text.length > 200) continue;
      const found = textDate(text, now);
      if (!found) continue;
      const title = text.replace(/\s{2,}/g, " ").slice(0, 140);
      if (!usableHeading(title)) continue;
      if (!firstOfDay(seen, title, found.date)) continue;
      out.push({
        title,
        startsAt: found.date,
        endsAt: null,
        allDay: found.allDay,
        description: null,
        url: pageUrl,
        uid: null,
        recurrence: null,
      });
    }
  }

  return out;
}

/** Discovers an ICS/RSS feed advertised in a page's markup. */
function discoverFeeds(html: string, base: string): { ics: string | null; rss: string | null } {
  const abs = (u: string) => {
    try {
      return new URL(u, base).toString();
    } catch {
      return null;
    }
  };
  const ics =
    html.match(/href="([^"]*\.ics(?:\?[^"]*)?)"/i)?.[1] ??
    html.match(/href="([^"]*calendar[^"]*ical[^"]*)"/i)?.[1] ??
    null;
  const rss =
    html.match(/<link[^>]+type="application\/(?:rss|atom)\+xml"[^>]*href="([^"]+)"/i)?.[1] ??
    html.match(/href="([^"]*\/(?:feed|rss)\/?)"/i)?.[1] ??
    null;
  return { ics: ics ? abs(ics) : null, rss: rss ? abs(rss) : null };
}

/* ------------------------------ ingestion -------------------------------- */

type PullResult = {
  kind: "ics" | "rss" | "gcal" | "events_html" | "site_html" | "none";
  events: ParsedEvent[];
  usedUrl: string | null;
  discovered: { ics?: string | null; rss?: string | null };
};

async function pullTemple(s: SourceRow, now: Date): Promise<PullResult> {
  const discovered: { ics?: string | null; rss?: string | null } = {};

  // 1 — declared ICS, then 3 — public Google Calendar (also ICS).
  for (const [kind, url] of [
    ["ics", s.ics_url],
    ["gcal", s.gcal_url],
  ] as const) {
    if (!url) continue;
    const body = await get(url, "text/calendar,text/plain");
    const events = body ? parseIcs(body, url) : [];
    if (events.length) return { kind, events, usedUrl: url, discovered };
  }

  // 2 — declared RSS.
  if (s.rss_url) {
    const body = await get(s.rss_url, "application/rss+xml,application/xml");
    const events = body ? parseRss(body, s.rss_url, now) : [];
    if (events.length) return { kind: "rss", events, usedUrl: s.rss_url, discovered };
  }

  // 4/5 — structured events page, then the homepage. Feeds advertised in the
  // markup are recorded so the next run uses the cheaper structured path.
  for (const [kind, url] of [
    ["events_html", s.events_url],
    ["site_html", s.website],
  ] as const) {
    if (!url) continue;
    const body = await get(url, "text/html");
    if (!body) continue;
    const feeds = discoverFeeds(body, url);
    if (feeds.ics && !s.ics_url) discovered.ics = feeds.ics;
    if (feeds.rss && !s.rss_url) discovered.rss = feeds.rss;
    if (feeds.ics) {
      const ics = await get(feeds.ics, "text/calendar,text/plain");
      const parsed = ics ? parseIcs(ics, feeds.ics) : [];
      if (parsed.length) return { kind: "ics", events: parsed, usedUrl: feeds.ics, discovered };
    }
    const events = parseHtml(body, url, now);
    if (events.length) return { kind, events, usedUrl: url, discovered };
  }

  return { kind: "none", events: [], usedUrl: null, discovered };
}

function keyFor(slug: string, title: string, startsAt: Date): string {
  const t = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 6)
    .join("-");
  return `${slug}:${startsAt.toISOString().slice(0, 16)}:${t}`.slice(0, 200);
}

export type TempleIngestSummary = {
  temples: number;
  checked: number;
  found: number;
  created: number;
  updated: number;
  needsReview: number;
  skipped: number;
  errors: { temple: string; error: string }[];
};

/**
 * Checks every active temple source once and upserts its upcoming programs.
 * Designed for a once/twice-a-day schedule — temple programs change slowly.
 */
export async function runTempleCalendarIngest(opts?: {
  slug?: string;
  budgetMs?: number;
}): Promise<TempleIngestSummary> {
  const db = await admin();
  const started = Date.now();
  const budget = opts?.budgetMs ?? 70_000;
  const now = new Date();
  const horizon = new Date(now.getTime() + 400 * 24 * 60 * 60 * 1000);

  await syncTempleSources();

  let q = db
    .from("temple_sources")
    .select(
      "id,slug,name,city,region,website,events_url,rss_url,ics_url,gcal_url,deities,active,auto_import,fail_count",
    )
    .eq("active", true)
    .eq("auto_import", true)
    .order("last_checked_at", { ascending: true, nullsFirst: true });
  if (opts?.slug) q = q.eq("slug", opts.slug);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const sources = (data ?? []) as SourceRow[];

  const summary: TempleIngestSummary = {
    temples: sources.length,
    checked: 0,
    found: 0,
    created: 0,
    updated: 0,
    needsReview: 0,
    skipped: 0,
    errors: [],
  };

  for (const s of sources) {
    if (Date.now() - started > budget) break;
    summary.checked += 1;
    try {
      const pulled = await pullTemple(s, now);
      summary.found += pulled.events.length;

      const seen = new Set<string>();
      for (const ev of pulled.events) {
        // Validation: title, real future date, temple identified.
        if (ev.title.length < 6 || ev.startsAt < now || ev.startsAt > horizon) {
          summary.skipped += 1;
          continue;
        }
        const key = keyFor(s.slug, ev.title, ev.startsAt);
        if (seen.has(key)) continue;
        seen.add(key);

        const text = `${ev.title} ${ev.description ?? ""}`;
        const { group, type } = detectEventGroup(text);
        const deities = detectDeities(text);
        const level: TempleEventLevel = classifyLevel(ev.title, ev.recurrence);
        // Loose HTML extraction is trustworthy for the date but not always for
        // the program itself — hold those for an editor.
        const structured = pulled.kind === "ics" || pulled.kind === "rss" || pulled.kind === "gcal";
        const confident = structured || level === "featured";
        const status = confident ? "published" : "needs_review";
        if (status === "needs_review") summary.needsReview += 1;

        const row = {
          source_id: s.id,
          temple_slug: s.slug,
          temple_name: s.name,
          city: s.city,
          region: s.region,
          title: ev.title.slice(0, 200),
          description: ev.description,
          starts_at: ev.startsAt.toISOString(),
          ends_at: ev.endsAt ? ev.endsAt.toISOString() : null,
          all_day: ev.allDay,
          deities: deities.length ? deities : s.deities,
          event_type: type,
          event_group: group,
          level,
          source_url: ev.url ?? pulled.usedUrl ?? s.website,
          source_kind: pulled.kind,
          recurrence: ev.recurrence,
          external_uid: ev.uid,
          imported: true,
          dedupe_key: key,
          last_seen_at: now.toISOString(),
          last_verified_at: now.toISOString(),
        };

        const { data: existing } = await db
          .from("temple_events")
          .select("id,status")
          .eq("dedupe_key", key)
          .maybeSingle();

        if (existing) {
          // The official temple site stays the preferred source: update, never
          // duplicate, and never resurrect something an editor rejected.
          const patch: Record<string, unknown> = { ...row };
          if ((existing as { status: string }).status === "rejected") {
            delete patch["status"];
          } else if ((existing as { status: string }).status === "needs_review") {
            patch["status"] = status === "published" ? "published" : "needs_review";
          }
          await db.from("temple_events").update(patch).eq("id", (existing as { id: string }).id);
          summary.updated += 1;
        } else {
          const { error: insErr } = await db.from("temple_events").insert({ ...row, status });
          if (!insErr) summary.created += 1;
        }
      }

      const ok = pulled.events.length > 0;
      const patch: Record<string, unknown> = {
        last_checked_at: now.toISOString(),
        ...(ok
          ? { last_success_at: now.toISOString(), last_error: null, fail_count: 0, status: "green" }
          : {
              fail_count: s.fail_count + 1,
              last_error: "No upcoming programs found on the published page or feed",
              status: s.fail_count + 1 >= 3 ? "red" : "yellow",
            }),
        ...(pulled.discovered.ics ? { ics_url: pulled.discovered.ics } : {}),
        ...(pulled.discovered.rss ? { rss_url: pulled.discovered.rss } : {}),
      };
      await db.from("temple_sources").update(patch).eq("id", s.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      summary.errors.push({ temple: s.name, error: message });
      await db
        .from("temple_sources")
        .update({
          last_checked_at: now.toISOString(),
          last_error: message.slice(0, 300),
          fail_count: s.fail_count + 1,
          status: s.fail_count + 1 >= 3 ? "red" : "yellow",
        })
        .eq("id", s.id);
    }
  }

  // Programs that vanished from their source are flagged, never deleted —
  // temple sites drop and restore pages all the time.
  const staleBefore = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  await db
    .from("temple_events")
    .update({ status: "needs_review" })
    .eq("status", "published")
    .eq("imported", true)
    .lt("last_seen_at", staleBefore)
    .gt("starts_at", now.toISOString());

  return summary;
}
