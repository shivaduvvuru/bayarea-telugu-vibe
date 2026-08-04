import { useMemo, useState } from "react";
import { type EventItem, eventDate } from "@/lib/news-data";
import { useLang } from "@/lib/language";

export type EventFilter =
  | "all"
  | "today"
  | "weekend"
  | "free"
  | "family"
  | "students"
  | "music"
  | "culture"
  | "spiritual"
  | "professional"
  | "sports";

const FILTERS: { key: EventFilter; en: string; te: string }[] = [
  { key: "all", en: "All", te: "అన్నీ" },
  { key: "today", en: "Today", te: "ఈ రోజు" },
  { key: "weekend", en: "This Weekend", te: "ఈ వారాంతం" },
  { key: "free", en: "Free", te: "ఉచితం" },
  { key: "family", en: "Family", te: "కుటుంబం" },
  { key: "students", en: "Students", te: "విద్యార్థులు" },
  { key: "music", en: "Music", te: "సంగీతం" },
  { key: "culture", en: "Culture", te: "సంస్కృతి" },
  { key: "spiritual", en: "Spiritual", te: "ఆధ్యాత్మికం" },
  { key: "professional", en: "Professional", te: "వృత్తి" },
  { key: "sports", en: "Sports", te: "క్రీడలు" },
];

function inWeekend(d: Date, now: Date) {
  const toFriday = (5 - now.getDay() + 7) % 7;
  const friday = new Date(now);
  friday.setDate(now.getDate() + toFriday);
  friday.setHours(0, 0, 0, 0);
  const monday = new Date(friday);
  monday.setDate(friday.getDate() + 3);
  return d >= friday && d < monday;
}

export function matchesFilter(e: EventItem, filter: EventFilter, now = new Date()) {
  if (filter === "all") return true;
  if (filter === "free") return e.free;
  const d = eventDate(e);
  if (filter === "today") return !!d && d.toDateString() === now.toDateString();
  if (filter === "weekend") return !!d && inWeekend(d, now);
  return e.tags?.includes(filter) ?? false;
}

export function useEventFilter(events: EventItem[]) {
  const [filter, setFilter] = useState<EventFilter>("all");
  const filtered = useMemo(
    () => events.filter((e) => matchesFilter(e, filter)),
    [events, filter],
  );
  return { filter, setFilter, filtered };
}

export function EventFilterBar({
  filter,
  onChange,
}: {
  filter: EventFilter;
  onChange: (f: EventFilter) => void;
}) {
  const { lang } = useLang();
  return (
    <div
      className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="group"
      aria-label="Filter events"
    >
      {FILTERS.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => onChange(f.key)}
          aria-pressed={filter === f.key}
          className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold transition-colors ${
            filter === f.key
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-ink hover:border-primary"
          }`}
        >
          <span className={lang === "te" ? "te-text" : undefined}>
            {lang === "te" ? f.te : f.en}
          </span>
        </button>
      ))}
    </div>
  );
}