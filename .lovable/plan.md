# Times Bay Area — lean digest OS, phase 1

Rename the project and lay the source-first foundation, without breaking anything that works today (homepage hero rotation, Glamour pockets, desk, publishing, auth, collection).

## Scope of this phase (Steps 1–5 of your order)

1. **Brand rename**
   - Site name -> `Times Bay Area`, tagline -> `What matters around you.`, canonical origin -> `https://timesbayarea.com` (kept overridable by env so preview keeps working).
   - Update header, footer, root + every route `head()` title/description, about, e-paper, submit, contact copy. Existing Telugu/Glamour sections keep working; only branding changes.

2. **Lean schema (Cloud migration)**
   - `cities`, `topics`, `content_sources`, `raw_ingestion_items`, `story_clusters`, `editorial_reviews`, `user_preferences`, `saved_items`, `user_actions`.
   - Reuse existing `content_items` and `events`-style data rather than duplicating them; add the few columns needed (`source_id`, `story_cluster_id`, `content_label`, `confidence`, `priority_score`, `why_it_matters`, `what_to_do`).
   - `content_sources` carries `source_class` (authority/reporter/community/organizer/internal/submission), `connector_type` (direct_rss/direct_api/goodbarber/manual/webhook), cities, topics, cadence, health fields (`last_checked_at`, `last_success_at`, `last_error`, `status`).
   - RLS: public read only for published/approved rows; staff-only for registry, raw items, reviews; per-user rows scoped to `auth.uid()`.
   - Seed the 5 launch cities, the 15 topics, and ~35 seed sources (Fremont, Milpitas, San Jose, Cupertino, Sunnyvale, Santa Clara + Alameda counties, BART, VTA, Caltrain, the school districts, BATA + temples/community orgs, selected Bay Area publishers, TeluguTimes).

3. **Generic ingestion**
   - One connector interface keyed on `connector_type`; only `direct_rss`, `direct_api`, `manual` implemented now. GoodBarber is a registered enum value with no code dependency.
   - Cron-driven collection writes to `raw_ingestion_items` (title, canonical URL, published_at, short excerpt, image, author, external id, status) — no full-article storage.
   - Per-source health writeback on every run.

4. **Cheap de-duplication** — canonical URL match, then normalized-headline similarity (reuse existing `dedupeKey`), then city+topic+date. Status: unique / possible_duplicate / duplicate / merged. Possible duplicates group into a `story_cluster` so multi-source stories render one card with `Sources: A · B`. No vector search.

5. **Command Center + Review Queue** at `/command-center` (behind the existing desk gate): today's counters (collected / duplicates / recommended / needs review / approved / published / source errors), source registry CRUD with health, and a keyboard-fast review queue — original vs AI proposal side by side, Approve / Edit / Reject(+reason) / Merge / Publish / Schedule. Auto-publish stays OFF for the risky topics you listed.

## Deferred to the next phase (explicitly not built now)

AI enrichment prompts wired into the queue, public Action Card / Daily Brief homepage, Upcoming, personalization, events rebuild, analytics dashboard, monetization slots. Step 6 onwards begins once ingestion + review are proven with real rows.

## Cost note

Nothing here adds recurring spend: Cloud (Supabase) free tier, RSS, existing Lovable AI Gateway key. GoodBarber stays untested code-wise until you run the trial.

## Technical notes

- Collection runs as TanStack server routes under `src/routes/api/public/hooks/*` driven by `pg_cron`, matching the existing collector; time-budgeted batches so no run exceeds the worker limit.
- New registry/ingestion logic lives in `src/lib/sources.*` and `src/lib/ingest.*`; existing `collect-news.server.ts` keeps working and is migrated onto the registry incrementally.
- Renaming touches copy only — no route deletions, no removal of frozen baseline features.
