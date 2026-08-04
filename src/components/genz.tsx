import { useState } from "react";
import { Play, ChevronLeft, ChevronRight, Tag, Quote } from "lucide-react";
import { DEALS, POLL, SHORT_VIDEOS, SWIPE_STORIES, VOICES } from "@/lib/genz-data";
import { SampleChip, SponsoredChip } from "@/components/story-actions";
import { HRail } from "@/components/news";
import { useLang } from "@/lib/language";
import { track } from "@/lib/analytics";

/** 9:16 short-video cards — "60-Second Bay Area". No autoplay, no sound. */
export function ShortVideoRail() {
  const { t } = useLang();
  return (
    <HRail label="60-Second Bay Area">
      {SHORT_VIDEOS.map((v) => (
        <a
          key={v.id}
          href={v.href}
          target="_blank"
          rel="noreferrer"
          onClick={() => track("video_view", { id: v.id })}
          className="group w-[46vw] shrink-0 snap-start sm:w-44"
        >
          <div className="relative overflow-hidden rounded-xl bg-surface-tint">
            <img
              src={v.poster}
              alt={v.title}
              width={720}
              height={1280}
              loading="lazy"
              decoding="async"
              className="aspect-[9/16] w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent" />
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-bold text-primary">
              <Play className="h-3 w-3" /> {v.duration}
            </span>
            <span className="absolute inset-x-2 bottom-2 line-clamp-3 text-[13px] leading-snug font-semibold text-background">
              {v.title}
            </span>
          </div>
          <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{v.city}</span>
            {v.sample && <SampleChip />}
          </p>
        </a>
      ))}
      <span className="sr-only">{t("Short videos", "చిన్న వీడియోలు")}</span>
    </HRail>
  );
}

/** 3–7 card swipe explainer. */
export function SwipeStoryCard({ story }: { story: (typeof SWIPE_STORIES)[number] }) {
  const [i, setI] = useState(0);
  const card = story.cards[i]!;
  const go = (d: number) =>
    setI((v) => Math.min(story.cards.length - 1, Math.max(0, v + d)));

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-tint px-4 py-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
          {story.kicker}
        </p>
        {story.sample && <SampleChip />}
      </div>
      <div className="p-4">
        <h3 className="text-lg leading-snug font-bold text-ink">{story.title}</h3>
        <div className="mt-4 min-h-[132px] rounded-lg bg-surface-tint p-4">
          <p className="text-sm font-bold text-primary">{card.heading}</p>
          <p className="mt-1.5 text-base leading-relaxed text-ink">{card.body}</p>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1.5" aria-hidden>
            {story.cards.map((_, n) => (
              <span
                key={n}
                className={`h-1.5 w-6 rounded-full ${n === i ? "bg-primary" : "bg-border"}`}
              />
            ))}
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={i === 0}
              aria-label="Previous card"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border disabled:opacity-40"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              disabled={i === story.cards.length - 1}
              aria-label="Next card"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border disabled:opacity-40"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function SwipeStories() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {SWIPE_STORIES.map((s) => (
        <SwipeStoryCard key={s.id} story={s} />
      ))}
    </div>
  );
}

export function DealsRail() {
  const { t } = useLang();
  return (
    <HRail label="Deals near us">
      {DEALS.map((d) => (
        <article
          key={d.id}
          className="w-[78vw] shrink-0 snap-start rounded-xl border border-border bg-background p-4 sm:w-72"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <Tag className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground">{d.city}</span>
            {d.sponsored && <SponsoredChip />}
            {d.sample && <SampleChip />}
          </div>
          <h3 className="mt-2 text-base font-bold text-ink">{d.business}</h3>
          <p className="mt-1 text-[15px] text-ink">{d.offer}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("Valid", "చెల్లుబాటు")}: {d.expires}
          </p>
        </article>
      ))}
    </HRail>
  );
}

export function VoicesRail() {
  return (
    <HRail label="Student and young professional voices">
      {VOICES.map((v) => (
        <article
          key={v.id}
          className="w-[80vw] shrink-0 snap-start rounded-xl bg-surface-tint p-4 sm:w-80"
        >
          <Quote className="h-5 w-5 text-primary" aria-hidden />
          <p className="mt-2 text-[15px] leading-relaxed text-ink">{v.quote}</p>
          <p className="mt-3 text-sm font-bold text-ink">{v.name}</p>
          <p className="text-xs text-muted-foreground">
            {v.role} · {v.city}
          </p>
          <p className="mt-2">{v.sample && <SampleChip />}</p>
        </article>
      ))}
    </HRail>
  );
}

/** Moderated single-question poll — results are local until a backend exists. */
export function CommunityPoll() {
  const { t } = useLang();
  const [choice, setChoice] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
        {t("Community poll", "కమ్యూనిటీ పోల్")}
      </p>
      <h3 className="mt-1.5 text-lg font-bold text-ink">{POLL.question}</h3>
      <ul className="mt-3 space-y-2">
        {POLL.options.map((o) => (
          <li key={o}>
            <button
              type="button"
              onClick={() => {
                setChoice(o);
                track("poll_vote", { poll: POLL.id, option: o });
              }}
              aria-pressed={choice === o}
              className={`flex min-h-11 w-full items-center rounded-lg border px-3 text-left text-[15px] transition-colors ${
                choice === o
                  ? "border-primary bg-surface-tint font-semibold text-primary"
                  : "border-border text-ink hover:border-primary"
              }`}
            >
              {o}
            </button>
          </li>
        ))}
      </ul>
      {choice && (
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          {t(
            "Thanks — your response was recorded on this device. Aggregate results are published weekly.",
            "ధన్యవాదాలు — మీ స్పందన నమోదైంది. ఫలితాలు ప్రతి వారం ప్రచురిస్తాము.",
          )}
        </p>
      )}
    </div>
  );
}