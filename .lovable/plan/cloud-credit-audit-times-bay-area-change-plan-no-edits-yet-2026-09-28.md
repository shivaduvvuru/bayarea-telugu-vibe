# Cloud credit audit — Times Bay Area (change plan, no edits yet)

Scope: small, targeted changes only. No redesign. The live job list could not be read (backend was asleep during the audit); job details below come from the job history and code. Before any edits, the job list will be re-read and checked against this plan.

## 1. Inventory and impact

| # | Item | Trigger / frequency | Impact | Minimal fix |
|---|------|---------------------|--------|-------------|
| A | News collect (`collect-news`, jobs at :20/:40) | cron, ~48/day, up to 240s each | **Highest.** Long runs keep the server and database awake; up to ~25 AI summary calls per run | Every 60 min (overnight PT 1–6am: every 3h); skip the AI step when nothing new comes in (already keyed on canonical URL — add an early exit when `newRows=0`) |
| B | Cinema job (job 25, :10/:30/:50) | cron, 72/day | High. 68 runs/day seen, most add 0–3 items | Every 30 min (:10/:40); keep the in-progress lock |
| C | Gallery/picture intake (job 11) | cron, 240s timeout | High: 2 image-check AI calls per photo | Keep; cache the check result per image address so re-seen photos cost nothing; cap at 40 photos per run |
| D | Glamour pocket swap (24), nightly reset, health audit 07:00, wire desk (26, daily), temple calendar, directory/OSM, Yelp, India ingest, dedupe sweep, image backfill, publish-news | cron, daily–hourly | Low–medium | Merge the hourly sweeps (dedupe, image backfill, publish) into the main collect run's tail instead of separate wake-ups; directory/Yelp to weekly |
| E | Article embeddings (`google/text-embedding-004`) | on mirror insert | Medium | Embed only when a title is new (skip if canonical URL already exists), batch per run |
| F | Moderation / sensitive check (gemini flash) | per story at ingest | Medium | Run only after keyword pre-filter flags a story; cache by canonical URL |
| G | Summaries (`gemini-3.1-flash-lite`, batched ≤25) | per collect run | Medium | Already batched + deduped before summary. Add: truncate input to 600 chars per item |
| H | Telugu translation | none | None | Removed with the English-only rule; nothing to do |
| I | Newsletter | none | None | No newsletter flow exists; nothing to do (analytics only mentions it) |
| J | Homepage queries | 3 queries refetch every 30 min + slider timers | Medium at traffic: each open tab re-hits the database | Stop refetch when tab hidden (`refetchIntervalInBackground:false`), raise to 60 min; homepage is already edge-cached 60s — raise to `s-maxage=300` |
| K | Category/desk pages (`postsQuery`) | poll via `newsRefreshMs` + refetch on focus | Medium–high: focus refetch fires every tab switch | Turn off `refetchOnWindowFocus`, poll only visible tabs, minimum 10 min |
| L | City headline hero, glamour dashboard, property live feed, `refresh-news` tick | 10–15 min timers | Low–medium | Pause when tab hidden; property feed 30 min |
| M | Article page | SSR, edge cache 5 min | Low | Raise to `s-maxage=900, swr=3600`; ensure lookup by `slug` uses an index |
| N | Business News (BizToc + Statista) | server call on every page view, no caching | Medium: 4 outside fetches per visitor | In-memory cache 15 min + `s-maxage=900` on `/business` |
| O | Politics feeds | every page view, all sources in parallel | Medium | Same 15-min cache |
| P | Page views / likes | write per view | Low–medium | Skip bots; one write per article per session |
| Q | Photo proxy `/api/public/media/*` | per image request | Medium bandwidth | Add `cache-control: public, max-age=86400, immutable` |
| R | Realtime subscriptions | none found | None | — |

## 2. Database indexes (one migration)

Add if missing (checked first with a read-only query):
- `content_items(status, resolved_category, published_at desc)` — desk pages
- `content_items(slug)` unique — article page
- `articles(published_at desc)` — digest/homepage
- `raw_ingestion_items(canonical_url)`, `(dedupe_key)` — ingest dedupe lookups
- `collect_runs(mode, started_at desc)` — health/audit
- Pagination: keep desk pages at 24 rows per page (confirm no unbounded selects in admin lists; add `.limit(200)`).

## 3. Rate limits
- Public hooks: reject a second run of the same mode within 5 minutes (reuse the cinema lock pattern for news/gallery).
- `/submit` and likes: max 10 requests per minute per visitor.

## 4. Expected result
Roughly 40–55% fewer server wake-ups per day (collect 48→~30, cinema 72→48, merged sweeps), fewer AI calls from caching, and less database load from visitor tabs.

## Technical details
- Files: `src/routes/index.tsx`, `src/lib/category-query.ts`, `src/components/{refresh-news,city-headline-hero,property-live-feed}.tsx`, `src/lib/business-news.functions.ts`, `src/lib/politics.functions.ts`, `src/server.ts` (cache headers), `src/routes/api/public/media/$.ts`, `src/lib/collect-news.server.ts` (early exit, input truncation), `src/lib/article-embedding.server.ts`, `src/lib/moderation.server.ts`, `src/lib/photo-subject.server.ts` (result cache via `url_resolutions`-style table), one index migration, cron reschedules via SQL.
- Frozen baseline preserved: glamour hero rotation, pocket swap, desk, publishing, auth, dedupe rules untouched in behaviour.
