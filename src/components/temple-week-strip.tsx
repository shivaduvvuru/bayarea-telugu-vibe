import { Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { listTempleEvents } from "@/lib/temple-calendar.functions";
import { listCommunityItems } from "@/lib/cms.functions";
import { isTempleNewsClean } from "@/lib/temple-purity";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type WeekItem = {
  key: string;
  title: string;
  when: string | null;
  place: string | null;
  href: string | null;
};

const templeWeekEventsQuery = queryOptions({
  queryKey: ["temple-week", "events"],
  queryFn: () => listTempleEvents({ data: { limit: 200 } }),
  staleTime: 15 * 60 * 1000,
});

const templeWeekNewsQuery = queryOptions({
  queryKey: ["temple-week", "news"],
  queryFn: () => listCommunityItems({ data: { kind: "announcement", limit: 80 } }),
  staleTime: 15 * 60 * 1000,
});

function dayLabel(iso: string, allDay: boolean): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  });
  if (allDay) return day;
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
  return `${day} · ${time}`;
}

/**
 * City News carries temple coverage only for the week ahead: programs starting
 * within the next seven days, plus temple announcements published in the last
 * seven days that clear the temple-purity gate. Anything older — and any temple
 * item that has already happened — is dropped rather than shown here.
 */
export function TempleWeekStrip() {
  const { data: events = [] } = useQuery(templeWeekEventsQuery);
  const { data: announcements = [] } = useQuery(templeWeekNewsQuery);

  const now = Date.now();
  const items: WeekItem[] = [];
  const seen = new Set<string>();

  const push = (item: WeekItem) => {
    const dupe = item.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 60);
    if (!dupe || seen.has(dupe)) return;
    seen.add(dupe);
    items.push(item);
  };

  for (const e of events) {
    const start = Date.parse(e.startsAt);
    if (!Number.isFinite(start)) continue;
    // Upcoming week only; past programs never surface in City News.
    if (start < now - 6 * 60 * 60 * 1000 || start > now + WEEK_MS) continue;
    push({
      key: `event-${e.id}`,
      title: e.title,
      when: dayLabel(e.startsAt, e.allDay),
      place: e.templeName ?? e.city ?? null,
      href: e.registerUrl ?? e.sourceUrl ?? null,
    });
  }

  for (const r of announcements) {
    if ((r.category ?? "").toLowerCase() !== "temples") continue;
    if (!isTempleNewsClean({ title: r.title, summary: r.summary, sourceUrl: r.link_url })) continue;
    const stamp = Date.parse(r.event_start ?? r.published_at ?? r.created_at);
    if (!Number.isFinite(stamp)) continue;
    // Announcements are fresh-only: this week's notices, nothing older.
    if (stamp < now - WEEK_MS || stamp > now + WEEK_MS) continue;
    push({
      key: `news-${r.id}`,
      title: r.title,
      when: r.event_start ? dayLabel(r.event_start, true) : "This week",
      place: r.venue ?? r.city ?? null,
      href: r.link_url ?? null,
    });
  }

  if (items.length === 0) return null;

  return (
    <section aria-label="Temple news this week" className="mt-6 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-ink">
          <CalendarDays className="h-4 w-4 text-primary" aria-hidden />
          Temple news · week ahead
        </h2>
        <Link to="/temples/calendar" className="text-xs font-semibold text-primary hover:underline">
          Full calendar
        </Link>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {items.slice(0, 6).map((item) => (
          <li key={item.key} className="rounded-lg border border-border/70 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
              {item.when}
            </p>
            {item.href ? (
              <a
                href={item.href}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-0.5 block text-sm font-bold leading-snug text-ink hover:text-primary"
              >
                {item.title}
              </a>
            ) : (
              <p className="mt-0.5 text-sm font-bold leading-snug text-ink">{item.title}</p>
            )}
            {item.place ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{item.place}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
