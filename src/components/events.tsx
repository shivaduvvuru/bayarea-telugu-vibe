import { CalendarPlus, MapPin, Navigation, Ticket, CalendarDays } from "lucide-react";
import { WhatsAppShare } from "@/components/whatsapp-share";
import { type EventItem, eventDate } from "@/lib/news-data";
import { useLang } from "@/lib/language";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function gcalStamp(value: string) {
  return `${value.replace(/[-:]/g, "")}00`;
}

export function googleCalendarUrl(e: EventItem) {
  const start = gcalStamp(e.start);
  const end = gcalStamp(e.end ?? e.start);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${start}/${end}`,
    location: `${e.venue}, ${e.address}`,
    details: `${e.organiser} · Listed on Times Bay Area`,
    ctz: "America/Los_Angeles",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function directionsUrl(e: EventItem) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    `${e.venue}, ${e.address}`,
  )}`;
}

export function DateBadge({ event }: { event: EventItem }) {
  const d = eventDate(event);
  if (!d) return null;
  return (
    <div
      className="flex h-16 w-16 shrink-0 flex-col items-center justify-center border-2 border-primary bg-surface-tint leading-none"
      aria-hidden
    >
      <span className="text-[11px] font-bold uppercase tracking-wide text-primary">
        {d.toLocaleDateString("en-US", { month: "short" })}
      </span>
      <span className="mt-0.5 text-2xl font-black text-ink">{pad(d.getDate())}</span>
    </div>
  );
}

const actionClass =
  "inline-flex min-h-11 items-center gap-1.5 rounded-sm border border-border px-3 text-[13px] font-semibold text-ink transition-colors hover:border-primary hover:text-primary";

export function EventCard({ event }: { event: EventItem }) {
  const { t } = useLang();
  const d = eventDate(event);

  return (
    <article
      className={`flex flex-col gap-3 border border-border bg-background p-4 ${
        event.sponsored ? "border-primary/50" : ""
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <DateBadge event={event} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                event.free
                  ? "bg-emerald-700 text-white"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {event.free ? t("Free", "ఉచితం") : (event.cost ?? t("Paid", "టికెట్"))}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">{event.city}</span>
            {event.sponsored && (
              <span className="border border-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                {t("Sponsored", "స్పాన్సర్డ్")}
              </span>
            )}
          </div>
          <h3 className="mt-1.5 text-base leading-snug font-bold text-ink">{event.title}</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {d
              ? d.toLocaleString("en-US", {
                  weekday: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })
              : ""}
          </p>
          <p className="mt-1 flex items-start gap-1.5 text-[13px] text-muted-foreground">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0">
              {event.venue}, {event.city}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("Organised by", "నిర్వాహకులు")} {event.organiser}
            {!event.verified && ` · ${t("details being confirmed", "వివరాలు నిర్ధారణలో")}`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <a className={actionClass} href={googleCalendarUrl(event)} target="_blank" rel="noreferrer">
          <CalendarPlus className="h-4 w-4" />
          {t("Add to Calendar", "క్యాలెండర్‌కు జోడించండి")}
        </a>
        <a className={actionClass} href={directionsUrl(event)} target="_blank" rel="noreferrer">
          <Navigation className="h-4 w-4" />
          {t("Directions", "దారి")}
        </a>
        {event.verified && event.registerUrl && (
          <a
            className="inline-flex min-h-11 items-center gap-1.5 rounded-sm bg-primary px-3 text-[13px] font-semibold text-primary-foreground hover:bg-primary-dark"
            href={event.registerUrl}
            target="_blank"
            rel="noreferrer"
          >
            <Ticket className="h-4 w-4" />
            {event.free ? t("Register", "నమోదు") : t("Buy Tickets", "టికెట్లు")}
          </a>
        )}
      </div>
    </article>
  );
}

export function EventStrip({ event }: { event: EventItem }) {
  const d = eventDate(event);
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0 truncate">
        {d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""} ·{" "}
        {event.title} · {event.city}
      </span>
      <WhatsAppShare
        path="/events"
        title={`${event.title} · ${event.city}`}
        context="event"
        tone="bare"
        className="h-8 w-8 shrink-0"
      />
    </div>
  );
}
