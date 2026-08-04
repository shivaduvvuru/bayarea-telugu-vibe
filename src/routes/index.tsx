import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { listPosts } from "@/lib/wp.functions";
import { listTempleAnnouncements } from "@/lib/temples.functions";
import { listPolitics } from "@/lib/politics.functions";
import { listCommunityItems } from "@/lib/cms.functions";
import { upcomingEvents, weekendEvents } from "@/lib/news-data";
import { articleLang, groupByOrg, isLocal } from "@/lib/wp";
import { useLang } from "@/lib/language";
import { canonical, HERITAGE_LINE, PARENT_SITE, SITE_TAGLINE } from "@/lib/site";
import {
  CommunityPoll,
  DealsRail,
  ShortVideoRail,
  SwipeStories,
  VoicesRail,
} from "@/components/genz";
import {
  HRail,
  LeadCard,
  MoreLink,
  RailCard,
  SectionHeading,
  SponsoredSlot,
  StoryCard,
} from "@/components/news";
import { QuickLinks } from "@/components/quick-links";
import { EventCard } from "@/components/events";
import { AdRail, RetailSponsors, TwoUpPromos } from "@/components/ads";
import { HousingHero } from "@/components/housing-hero";

const TITLE = "Bay Area Telugu Times — Local Telugu news, events & community";
const DESC =
  "Local news, events, culture, food and community connections for Telugu people across the San Francisco Bay Area.";
const HOME_URL = canonical("/");

const latestQuery = queryOptions({
  queryKey: ["home", "posts", "snapshot-v1"],
  queryFn: () => listPosts({ data: { perPage: 40, instant: true, compact: true } }),
  staleTime: 30 * 60 * 1000,
});

/** Pulled straight from temple websites — independent of the newsroom feed. */
const templeQuery = queryOptions({
  queryKey: ["temples", "announcements"],
  queryFn: () => listTempleAnnouncements(),
  staleTime: 30 * 60 * 1000,
});

/** Community-submitted and editor-published items from the newsroom CMS. */
const communityQuery = queryOptions({
  queryKey: ["cms", "community", "home"],
  queryFn: () => listCommunityItems({ data: { limit: 12 } }),
  staleTime: 5 * 60 * 1000,
});

/** City-hall and Indian political headlines, pulled from publisher feeds. */
const politicsQuery = queryOptions({
  queryKey: ["politics", "all"],
  queryFn: () => listPolitics(),
  staleTime: 30 * 60 * 1000,
});

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    // This is a compact, in-process snapshot read: no database or remote
    // publisher is allowed on the critical path to first paint.
    await context.queryClient.ensureQueryData(latestQuery);
  },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: HOME_URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: HOME_URL }],
  }),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center" role="alert">
      <h1 className="text-2xl font-bold text-ink">Newsroom feed unavailable</h1>
      <p className="mt-2 text-base text-muted-foreground">{error.message}</p>
    </div>
  ),
  component: Index,
});

function Index() {
  const { t } = useLang();
  const { data: articles } = useSuspenseQuery(latestQuery);
  const { data: templeFeeds = [] } = useQuery(templeQuery);
  const { data: communityItems = [] } = useQuery(communityQuery);
  const { data: politicsGroups = [] } = useQuery(politicsQuery);

  if (articles.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-ink">No stories published yet</h1>
      </div>
    );
  }

  const inCat = (slug: string) => articles.filter((a) => a.category === slug);
  const local = articles.filter(isLocal);
  // Bay Area first: the lead is always a local story when one exists.
  const lead = local[0] ?? articles[0]!;
  const rest = articles.filter((a) => a.slug !== lead.slug);
  const localRest = rest.filter(isLocal);
  const trending = localRest.slice(0, 8);
  const latestLocal = localRest.slice(8, 14);

  const community = [
    ...inCat("community"),
    ...inCat("associations"),
    ...inCat("events-community"),
    ...inCat("groups"),
    ...inCat("people"),
  ].filter((a) => a.slug !== lead.slug);

  const temples = groupByOrg(inCat("temples").filter((a) => a.slug !== lead.slug));
  const restaurants = inCat("restaurants");
  const classifieds = inCat("classifieds");
  const political = inCat("political");
  const funZone = inCat("fun-zone");
  // Cinema on the homepage stays English-readable for Gen Z readers who
  // can't read Telugu script; Telugu-script cinema posts live on /category/cinema.
  const cinema = inCat("cinema").filter((a) => articleLang(a) !== "te");
  const fromMainSite = articles.filter((a) => !isLocal(a) && a.category !== "cinema");

  const events = upcomingEvents();
  const weekend = weekendEvents();
  const briefing = [lead, ...trending].slice(0, 3);

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 md:py-8">
      <h1 className="sr-only">
        Bay Area Telugu Times — {SITE_TAGLINE} Local Telugu news, events and community.
      </h1>

      {/* Identity + heritage */}
      <section className="rounded-xl bg-surface-tint p-4 md:p-6">
        <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
          {SITE_TAGLINE}
        </p>
        <p className="mt-1.5 text-base leading-relaxed text-ink">
          {t(
            "Bay Area Telugu news, events and community information — updated daily.",
            "బే ఏరియా తెలుగు వార్తలు, ఈవెంట్లు, కమ్యూనిటీ సమాచారం — ప్రతిరోజూ అప్‌డేట్.",
          )}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          <a href={PARENT_SITE} target="_blank" rel="noreferrer" className="hover:text-primary">
            {HERITAGE_LINE}
          </a>
        </p>

        {/* What's Happening Today briefing */}
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {t("What's happening today", "ఈ రోజు ఏం జరుగుతోంది")}
          </p>
          <ul className="mt-2 space-y-1.5">
            {briefing.map((a) => (
              <li key={a.id} className="flex gap-2">
                <span aria-hidden className="text-primary">
                  •
                </span>
                <Link
                  to="/article/$slug"
                  params={{ slug: a.slug }}
                  className={`min-w-0 text-[15px] leading-snug font-semibold headline-link ${
                    articleLang(a) === "te" ? "te-text" : ""
                  }`}
                >
                  {a.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 1 — Main Bay Area story */}
      <section className="mt-8">
        <SectionHeading
          te="బే ఏరియా ముఖ్యాంశం"
          en="Bay Area Top Story"
          more={<MoreLink category="city-news" />}
        />
        <HousingHero />
        <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <LeadCard article={lead} />
          <SponsoredSlot
            kind={t("Sponsored local business", "స్పాన్సర్డ్ స్థానిక వ్యాపారం")}
            title={t("Reach 20,000 Bay Area Telugu families", "20,000 తెలుగు కుటుంబాలకు చేరండి")}
            body={t(
              "This slot is reserved for a Bay Area Telugu-owned business. Restaurants, realtors, tax and immigration professionals can sponsor the homepage.",
              "ఈ స్థానం బే ఏరియా తెలుగు వ్యాపారాల కోసం. రెస్టారెంట్లు, రియల్టర్లు, ట్యాక్స్ మరియు ఇమిగ్రేషన్ నిపుణులు స్పాన్సర్ చేయవచ్చు.",
            )}
            cta={t("Advertise with us", "ప్రకటన ఇవ్వండి")}
            href="/contact"
          />
        </div>
      </section>

      {/* 2 — Events this weekend */}
      <section className="mt-10">
        <SectionHeading
          te="ఈ వారాంతం ఈవెంట్స్"
          en={weekend.length > 0 ? "Events This Weekend" : "Upcoming Events"}
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(weekend.length > 0 ? weekend : events).slice(0, 3).map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/events"
            className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-dark"
          >
            {t("Full events calendar", "పూర్తి ఈవెంట్స్ క్యాలెండర్")}
          </Link>
          <Link
            to="/contact"
            className="inline-flex min-h-11 items-center rounded-full border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
          >
            {t("Submit an event", "ఈవెంట్ పంపండి")}
          </Link>
        </div>
      </section>

      {/* 3 — 60-Second Bay Area */}
      <section className="mt-10">
        <SectionHeading te="60 సెకన్ల బే ఏరియా" en="60-Second Bay Area" />
        <ShortVideoRail />
      </section>

      {/* 4 — Trending near us */}
      {trending.length > 0 && (
        <section className="mt-10">
          <SectionHeading
            te="మన చుట్టుపక్కల ట్రెండింగ్"
            en="Trending Near Us"
            more={<MoreLink category="city-news" />}
          />
          <HRail label="Trending near us">
            {trending.map((a) => (
              <RailCard key={a.id} article={a} />
            ))}
          </HRail>
        </section>
      )}

      <RetailSponsors />

      <TwoUpPromos />

      {/* 5 — Latest local news, with the ad skyscraper alongside */}
      {latestLocal.length > 0 && (
        <section className="mt-12">
          <SectionHeading
            te="తాజా స్థానిక వార్తలు"
            en="Latest Local News"
            more={<MoreLink category="city-news" />}
          />
          <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
            <div className="grid gap-6 sm:grid-cols-2">
              {latestLocal.map((a) => (
                <StoryCard key={a.id} article={a} />
              ))}
            </div>
            <AdRail />
          </div>
        </section>
      )}

      {/* 6 — Food and places */}
      <section className="mt-12">
        <SectionHeading
          te="ఆహారం & ప్రదేశాలు"
          en="Food & Places"
          more={<MoreLink category="restaurants" />}
        />
        {restaurants.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {restaurants.slice(0, 3).map((a) => (
              <StoryCard key={a.id} article={a} />
            ))}
          </div>
        ) : (
          <p className="text-base text-muted-foreground">
            {t(
              "Telugu-owned restaurants, grocers and weekend food spots across the Bay Area.",
              "బే ఏరియా అంతటా తెలుగు రెస్టారెంట్లు, కిరాణా దుకాణాలు, వారాంతపు ఫుడ్ స్పాట్‌లు.",
            )}
          </p>
        )}
        <div className="mt-5">
          <SectionHeading te="మన దగ్గర డీల్స్" en="Deals Near Us" />
          <DealsRail />
        </div>
      </section>

      {/* 7 — Community and culture */}
      {community.length > 0 && (
        <section className="mt-12">
          <SectionHeading
            te="కమ్యూనిటీ & సంస్కృతి"
            en="Community & Culture"
            more={<MoreLink category="community" />}
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {community.slice(0, 6).map((a) => (
              <StoryCard key={a.id} article={a} />
            ))}
          </div>
          <div className="mt-6">
            <SwipeStories />
          </div>
        </section>
      )}

      {/* 8 — Student & young professional voices */}
      <section className="mt-12">
        <SectionHeading
          te="విద్యార్థుల & యువ నిపుణుల గొంతుకలు"
          en="Student & Young Professional Voices"
        />
        <VoicesRail />
      </section>

      {/* 9 — Cinema (supporting content, deliberately below local) */}
      {cinema.length > 0 && (
        <section className="mt-12">
          <SectionHeading te="సినిమా" en="Cinema" more={<MoreLink category="cinema" />} />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {cinema.slice(0, 3).map((a) => (
              <StoryCard key={a.id} article={a} />
            ))}
          </div>
        </section>
      )}

      {/* 10 — Temples, with repeat announcements from one temple collapsed */}
      {political.length > 0 && (
        <section className="mt-12">
          <SectionHeading
            te="పొలిటికల్"
            en="Political"
            more={<MoreLink category="political" />}
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {political.slice(0, 3).map((a) => (
              <StoryCard key={a.id} article={a} />
            ))}
          </div>
        </section>
      )}

      {/* City hall + Indian politics, pulled live from publisher feeds */}
      {politicsGroups.length > 0 && (
        <section className="mt-12">
          <SectionHeading
            te="రాజకీయాలు"
            en="City Hall & Indian Politics"
            more={
              <Link to="/politics" className="text-sm font-semibold text-primary">
                All political news
              </Link>
            }
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ...politicsGroups.filter((g) => g.scope === "local"),
              ...politicsGroups.filter((g) => g.scope === "india"),
            ]
              .slice(0, 6)
              .map((g) => (
                <article key={g.id} className="border border-border bg-card p-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-primary">
                    {g.scope === "local" ? g.region : "India"}
                  </p>
                  <h3 className="mt-1 text-base font-bold text-ink">{g.place}</h3>
                  <ul className="mt-3 space-y-3">
                    {g.stories.slice(0, 3).map((s) => (
                      <li key={s.url}>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-semibold leading-snug text-foreground hover:text-primary"
                        >
                          {s.title}
                        </a>
                        <p className="mt-0.5 text-xs text-muted-foreground">{s.publisher}</p>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
          </div>
        </section>
      )}

      {funZone.length > 0 && (
        <section className="mt-12">
          <SectionHeading
            te="ఫన్ జోన్"
            en="Fun Zone"
            more={<MoreLink category="fun-zone" />}
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {funZone.slice(0, 3).map((a) => (
              <StoryCard key={a.id} article={a} />
            ))}
          </div>
        </section>
      )}

      {templeFeeds.some((f) => f.announcements.length > 0) && (
        <section className="mt-12">
          <SectionHeading
            te="దేవాలయ ప్రకటనలు"
            en="Temple Announcements"
            more={
              <Link to="/temples" className="text-sm font-semibold text-primary">
                {t("All temples", "అన్ని దేవాలయాలు")}
              </Link>
            }
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {templeFeeds
              .filter((f) => f.announcements.length > 0)
              .slice(0, 3)
              .map((f) => (
                <article key={f.id} className="border border-border bg-card p-5">
                  <h3 className="text-base font-bold text-ink">{f.name}</h3>
                  <p className="mt-0.5 text-xs uppercase tracking-wide text-muted-foreground">
                    {f.city}
                  </p>
                  <ul className="mt-3 space-y-1.5">
                    {f.announcements.slice(0, 5).map((a) => (
                      <li key={a.title}>
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-h-11 items-center text-[15px] font-semibold headline-link"
                        >
                          {a.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
          </div>
        </section>
      )}

      {temples.length > 0 && (
        <section className="mt-12">
          <SectionHeading
            te="దేవాలయాలు & ఆధ్యాత్మికం"
            en="Temples & Spiritual Events"
            more={<MoreLink category="temples" />}
          />
          <ul className="divide-y divide-border border-y border-border">
            {temples.slice(0, 6).map((g) => (
              <li key={g.key} className="py-4">
                {g.rest.length > 0 ? (
                  <>
                    <h3 className="text-base font-bold text-ink">
                      {t(
                        `Upcoming events at ${g.org}`,
                        `${g.org} లో రాబోయే కార్యక్రమాలు`,
                      )}
                    </h3>
                    <ul className="mt-2 space-y-1.5">
                      {[g.lead, ...g.rest].map((a) => (
                        <li key={a.id}>
                          <Link
                            to="/article/$slug"
                            params={{ slug: a.slug }}
                            className={`flex min-h-11 items-center text-[15px] font-semibold headline-link ${
                              articleLang(a) === "te" ? "te-text" : ""
                            }`}
                          >
                            {a.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <Link
                    to="/article/$slug"
                    params={{ slug: g.lead.slug }}
                    className={`flex min-h-11 items-center text-[15px] font-semibold headline-link ${
                      articleLang(g.lead) === "te" ? "te-text" : ""
                    }`}
                  >
                    {g.lead.title}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 11 — Jobs, directory and classifieds */}
      {communityItems.length > 0 && (
        <section className="mt-12">
          <SectionHeading
            te="కమ్యూనిటీ నుండి"
            en="From the Community"
            more={
              <Link to="/submit" className="text-sm font-semibold text-primary">
                {t("Submit yours", "మీది పంపండి")}
              </Link>
            }
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {communityItems.slice(0, 6).map((item) => (
              <article key={item.id} className="border border-border bg-card p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {item.kind}
                  {item.city ? ` · ${item.city}` : ""}
                </p>
                <h3 className="mt-1 text-base font-bold text-ink">
                  {item.link_url ? (
                    <a
                      href={item.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="headline-link"
                    >
                      {item.title}
                    </a>
                  ) : (
                    item.title
                  )}
                </h3>
                {item.summary && (
                  <p className="mt-2 text-sm text-muted-foreground">{item.summary}</p>
                )}
                {item.venue && (
                  <p className="mt-2 text-xs text-muted-foreground">{item.venue}</p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="mt-12">
        <SectionHeading
          te="ఉద్యోగాలు, డైరెక్టరీ & క్లాసిఫైడ్స్"
          en="Jobs, Directory & Classifieds"
          more={<MoreLink category="classifieds" />}
        />
        <QuickLinks />
        {classifieds.length > 0 && (
          <ul className="mt-5 divide-y divide-border border-y border-border">
            {classifieds.slice(0, 6).map((a) => (
              <li key={a.id} className="py-3">
                <Link
                  to="/article/$slug"
                  params={{ slug: a.slug }}
                  className={`flex min-h-11 items-center text-[15px] font-semibold headline-link ${
                    articleLang(a) === "te" ? "te-text" : ""
                  }`}
                >
                  {a.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <SponsoredSlot
            kind={t("Featured job", "ఫీచర్డ్ ఉద్యోగం")}
            title={t("Hiring in the Bay Area?", "బే ఏరియాలో నియామకాలా?")}
            body={t(
              "Featured job posts appear at the top of the classifieds section for two weeks.",
              "ఫీచర్డ్ ఉద్యోగ ప్రకటనలు రెండు వారాల పాటు పైన కనిపిస్తాయి.",
            )}
            cta={t("Post a job", "ఉద్యోగం పోస్ట్ చేయండి")}
            href="/contact"
          />
          <SponsoredSlot
            kind={t("Premium directory listing", "ప్రీమియం డైరెక్టరీ లిస్టింగ్")}
            title={t("Doctors, realtors, CPAs & attorneys", "డాక్టర్లు, రియల్టర్లు, CPA, న్యాయవాదులు")}
            body={t(
              "Premium listings appear at the top of the directory with photo, hours and contact details.",
              "ప్రీమియం లిస్టింగ్‌లు ఫోటో, సమయాలు, వివరాలతో డైరెక్టరీలో పైన కనిపిస్తాయి.",
            )}
            cta={t("Upgrade a listing", "లిస్టింగ్ అప్‌గ్రేడ్")}
            href="/contact"
          />
        </div>
      </section>

      {/* 12 — Trending across Telugu Times (main-site content) */}
      {fromMainSite.length > 0 && (
        <section className="mt-12">
          <SectionHeading te="తెలుగు టైమ్స్‌లో ట్రెండింగ్" en="Trending Across Telugu Times" />
          <p className="-mt-3 mb-4 text-xs text-muted-foreground">
            {t(
              "Selected stories from the main Telugu Times newsroom.",
              "ప్రధాన తెలుగు టైమ్స్ నుండి ఎంపిక చేసిన కథనాలు.",
            )}
          </p>
          <HRail label="Trending across Telugu Times">
            {fromMainSite.slice(0, 8).map((a) => (
              <RailCard key={a.id} article={a} />
            ))}
          </HRail>
        </section>
      )}

      {/* 13 — Newsletter + poll + submission */}
      <section className="mt-12 grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border-2 border-ink p-6 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {t("Newsletter sponsorship available", "న్యూస్‌లెటర్ స్పాన్సర్‌షిప్ అందుబాటులో")}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-ink">{t("Newsletter", "వార్తా లేఖ")}</h2>
          <p className="mt-2 text-base text-muted-foreground">
            {t(
              "A weekly digest of Bay Area Telugu news and events, delivered every Friday.",
              "ప్రతి శుక్రవారం బే ఏరియా తెలుగు వార్తలు, ఈవెంట్ల సారాంశం మీ ఇన్‌బాక్స్‌కు.",
            )}
          </p>
          <form
            className="mx-auto mt-5 flex max-w-md flex-col gap-2 sm:flex-row"
            onSubmit={(e) => e.preventDefault()}
          >
            <input
              type="email"
              required
              aria-label="Email address"
              placeholder="you@example.com"
              className="min-h-11 flex-1 rounded-lg border border-input px-3 py-2.5 text-base outline-none focus:border-primary"
            />
            <button className="min-h-11 rounded-lg bg-primary px-5 text-base font-semibold text-primary-foreground hover:bg-primary-dark">
              {t("Subscribe", "సబ్‌స్క్రైబ్")}
            </button>
          </form>
          <p className="mt-4 text-sm text-muted-foreground">
            {t("Got a story, event or photo?", "వార్త, ఈవెంట్ లేదా ఫోటో ఉందా?")}{" "}
            <Link to="/contact" className="font-semibold text-primary">
              {t("Submit it to the newsroom", "న్యూస్‌రూమ్‌కు పంపండి")}
            </Link>
          </p>
        </div>
        <CommunityPoll />
      </section>
    </div>
  );
}