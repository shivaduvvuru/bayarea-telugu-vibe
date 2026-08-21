import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { CalendarDays, ExternalLink, List, MapPin, Search } from "lucide-react";
import { listTempleEvents, listTempleSources } from "@/lib/temple-calendar.functions";
import { listCommunityItems } from "@/lib/cms.functions";
import {
  DATE_RANGES,
  DEITY_OPTIONS,
  EVENT_GROUP_OPTIONS,
  formatEventDay,
  formatEventTime,
  matchesSearch,
  rangeWindow,
  type DateRangeKey,
  type TempleEventDTO,
} from "@/lib/temple-calendar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const eventsQuery = queryOptions({
  queryKey: ["temple-events", "calendar"],
  queryFn: () => listTempleEvents({ data: { limit: 500 } }),
  staleTime: 30 * 60 * 1000,
});

const templesQuery = queryOptions({
  queryKey: ["temple-sources", "public"],
  queryFn: () => listTempleSources(),
  staleTime: 60 * 60 * 1000,
});

const TITLE = "Bay Area Temple Calendar — pujas, festivals & spiritual programs";
const DESC =
  "One calendar for Hindu temple programs across Fremont, Milpitas, San Jose, Sunnyvale and the Tri-Valley. Filter by date, city, temple, deity and event type.";
const URL = "https://bayarea-telugu-vibe.lovable.app/temples/calendar";

export const Route = createFileRoute("/temples/calendar")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: TempleCalendarPage,
});

type ViewMode = "list" | "calendar";

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-border bg-background px-2 text-sm text-ink"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TempleCalendarPage() {
  const { data: events = [], isLoading } = useQuery(eventsQuery);
  const { data: temples = [] } = useQuery(templesQuery);

  const [range, setRange] = useState<DateRangeKey>("upcoming");
  const [city, setCity] = useState("all");
  const [temple, setTemple] = useState("all");
  const [deity, setDeity] = useState("all");
  const [group, setGroup] = useState("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("list");

  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of temples) if (t.city) set.add(t.city);
    for (const e of events) if (e.city) set.add(e.city);
    return [
      { value: "all", label: "All Bay Area" },
      ...[...set].sort().map((c) => ({ value: c, label: c })),
    ];
  }, [temples, events]);

  const templeOptions = useMemo(
    () => [
      { value: "all", label: "All temples" },
      ...temples.map((t) => ({ value: t.slug, label: t.name })),
    ],
    [temples],
  );

  const filtered = useMemo(() => {
    const { from, to } = rangeWindow(range);
    return events.filter((e) => {
      const start = new Date(e.startsAt);
      const end = e.endsAt ? new Date(e.endsAt) : start;
      if (end < from) return false;
      if (to && start >= to) return false;
      if (city !== "all" && e.city !== city) return false;
      if (temple !== "all" && e.templeSlug !== temple) return false;
      if (deity !== "all" && !e.deities.includes(deity)) return false;
      if (group !== "all" && e.eventGroup !== group) return false;
      return matchesSearch(e, query);
    });
  }, [events, range, city, temple, deity, group, query]);

  const byDay = useMemo(() => {
    const map = new Map<string, TempleEventDTO[]>();
    for (const e of filtered) {
      const key = new Date(e.startsAt).toDateString();
      const list = map.get(key);
      if (list) list.push(e);
      else map.set(key, [e]);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:py-8">
      <h1 className="text-3xl font-bold text-ink">Bay Area Temple Calendar</h1>
      <p className="mt-2 text-base text-muted-foreground">
        Pujas, festivals, discourses and cultural programs published by Bay Area temples — one
        calendar instead of thirty websites. Filter by date, city, temple, deity or program type.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Select
          label="Date"
          value={range}
          onChange={(v) => setRange(v as DateRangeKey)}
          options={DATE_RANGES.map((d) => ({ value: d.value, label: d.label }))}
        />
        <Select label="City" value={city} onChange={setCity} options={cityOptions} />
        <Select label="Temple" value={temple} onChange={setTemple} options={templeOptions} />
        <Select
          label="Deity"
          value={deity}
          onChange={setDeity}
          options={[
            { value: "all", label: "All deities" },
            ...DEITY_OPTIONS.map((d) => ({ value: d, label: d })),
          ]}
        />
        <Select
          label="Type"
          value={group}
          onChange={setGroup}
          options={[{ value: "all", label: "All types" }, ...EVENT_GROUP_OPTIONS]}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try “Venkateswara this weekend” or “Shiva puja Fremont”"
            className="pl-8"
            aria-label="Search temple programs"
          />
        </div>
        <div className="flex overflow-hidden rounded-md border border-border">
          <button
            type="button"
            onClick={() => setView("list")}
            aria-pressed={view === "list"}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold ${view === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
          >
            <List className="size-4" aria-hidden="true" /> List
          </button>
          <button
            type="button"
            onClick={() => setView("calendar")}
            aria-pressed={view === "calendar"}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold ${view === "calendar" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
          >
            <CalendarDays className="size-4" aria-hidden="true" /> Calendar
          </button>
        </div>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        {isLoading
          ? "Loading temple programs…"
          : `${filtered.length} program${filtered.length === 1 ? "" : "s"} found`}
      </p>

      {!isLoading && filtered.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No temple programs match these filters yet. Try “Upcoming” and “All Bay Area”, or browse
            the{" "}
            <Link to="/temples" className="font-semibold text-primary">
              temple directory
            </Link>
            .
          </p>
        </div>
      )}

      {view === "list" ? (
        <div className="mt-5 space-y-6">
          {byDay.map(([day, list]) => {
            const chip = formatEventDay(list[0]!.startsAt);
            return (
              <section key={day}>
                <h2 className="text-xs font-bold uppercase tracking-wide text-primary">
                  {chip.dow} · {chip.date}
                </h2>
                <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-card">
                  {list.map((e) => (
                    <EventRow key={e.id} event={e} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <MonthGrid events={filtered} />
      )}

      <TempleNews />
    </div>
  );
}

/**
 * Temple news publishes automatically (no approval) and lands as an
 * announcement in the "temples" category, so it belongs on the Temples menu
 * rather than general Events.
 */
const templeNewsQuery = queryOptions({
  queryKey: ["cms", "temple-news"],
  queryFn: () => listCommunityItems({ data: { kind: "announcement", limit: 60 } }),
  staleTime: 10 * 60 * 1000,
});

function TempleNews() {
  const { data = [] } = useQuery(templeNewsQuery);
  const rows = data.filter((r) => (r.category ?? "").toLowerCase() === "temples").slice(0, 12);
  if (rows.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold text-ink">Temple news</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Announcements and coverage from Bay Area temples, published automatically as they arrive.
      </p>
      <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
        {rows.map((r) => (
          <li key={r.id} className="flex items-start gap-3 p-3">
            {r.image_url && (
              <img
                src={r.image_url}
                alt={r.title}
                loading="lazy"
                className="h-16 w-16 flex-none rounded-md object-cover"
              />
            )}
            <div className="min-w-0">
              {r.link_url ? (
                <a
                  href={r.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-base font-semibold text-ink"
                >
                  {r.title}
                </a>
              ) : (
                <span className="text-base font-semibold text-ink">{r.title}</span>
              )}
              {r.summary && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.summary}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EventRow({ event: e }: { event: TempleEventDTO }) {
  return (
    <li className="p-3">
      <div className="flex items-start gap-3">
        {e.imageUrl && e.level === "featured" && (
          <img
            src={e.imageUrl}
            alt={e.title}
            loading="lazy"
            className="h-20 w-28 flex-none rounded-md object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold leading-snug text-ink">{e.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {e.templeSlug ? (
              <Link
                to="/temples/temple/$slug"
                params={{ slug: e.templeSlug }}
                className="font-medium text-primary hover:underline"
              >
                {e.templeName}
              </Link>
            ) : (
              e.templeName
            )}
            {e.city && (
              <span className="ml-1 inline-flex items-center gap-1">
                <MapPin className="size-3" aria-hidden="true" />
                {e.city}
              </span>
            )}
            <span className="ml-1">· {formatEventTime(e.startsAt, e.allDay)}</span>
          </p>
          {e.description && e.level !== "routine" && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{e.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{e.eventType}</Badge>
            {e.deities.map((d) => (
              <Badge key={d} variant="outline">
                {d}
              </Badge>
            ))}
            {e.level === "featured" && <Badge>Featured</Badge>}
            {e.recurrence && <Badge variant="outline">Recurring</Badge>}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {e.sourceUrl ? (
              <a
                href={e.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary"
              >
                Source: official temple website
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            ) : (
              "Source: official temple website"
            )}
            {" · Last verified "}
            {new Date(e.lastVerifiedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
      </div>
    </li>
  );
}

/** Compact month grid — deliberately secondary to the list view. */
function MonthGrid({ events }: { events: TempleEventDTO[] }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const base = new Date();
  const month = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
  const first = month.getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

  const perDay = new Map<number, TempleEventDTO[]>();
  for (const e of events) {
    const d = new Date(e.startsAt);
    if (d.getMonth() !== month.getMonth() || d.getFullYear() !== month.getFullYear()) continue;
    const list = perDay.get(d.getDate());
    if (list) list.push(e);
    else perDay.set(d.getDate(), [e]);
  }

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setMonthOffset((m) => m - 1)}>
          Previous
        </Button>
        <p className="text-sm font-semibold text-ink">
          {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
        <Button variant="outline" size="sm" onClick={() => setMonthOffset((m) => m + 1)}>
          Next
        </Button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-muted-foreground">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={`${d}-${i}`}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: first }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {Array.from({ length: days }).map((_, i) => {
          const day = i + 1;
          const list = perDay.get(day) ?? [];
          return (
            <div
              key={day}
              className="min-h-20 rounded-md border border-border bg-card p-1 text-left"
            >
              <p className="text-[11px] font-semibold text-muted-foreground">{day}</p>
              {list.slice(0, 3).map((e) => (
                <p key={e.id} className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-ink">
                  {e.title}
                </p>
              ))}
              {list.length > 3 && (
                <p className="mt-0.5 text-[10px] text-primary">+{list.length - 3} more</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
