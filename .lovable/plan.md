# Plan: Real Indian community content + directory

## Decisions from questions
- **TeluguTimes.net**: stop ingest + backfill with more sources; do NOT delete existing published stories.
- **Directory data**: seed from OpenStreetMap (Overpass), which is already built.
- **Reader submissions**: moderated queue (already implemented at `/submit`).
- **Placeholders**: delete only clearly fake ones; keep live DB-backed listings.

## Current findings
- Directory is already DB-backed (`directory_entities`, ~2,866 real OSM listings across food, health, shopping, education, religious, etc.).
- Food/restaurants are DB-backed (`restaurants` table) with real data.
- Events page mixes live CMS events with a hardcoded `EVENTS` array.
- Temple directory is a hardcoded `TEMPLES` array in `src/lib/temple-directory.ts` (real temples, but static).
- Property pages (`/property`, `/nri-real-estate`, `/credai-show`) use hardcoded data with fabricated RERA numbers and invented pricing — the clearest fake listings.
- TeluguTimes feeds are active in 3 files: `wp-source.server.ts`, `india-ingest.server.ts`, `collect-news.server.ts`.
- Reader submission page `/submit` already exists and writes to a moderated queue.

## Work phases

### Phase 1 — Stop TeluguTimes ingestion
1. Remove `WORDPRESS_SOURCES` entries for `bayarea.telugutimes.net` and `www.telugutimes.net/en` from `src/lib/wp-source.server.ts`.
2. Remove `"India Desk (English)"` and `"India Web Stories"` RSS entries from `src/lib/india-ingest.server.ts`.
3. Remove `"Cinema Desk"` telugutimes RSS entry from `src/lib/collect-news.server.ts`.
4. Leave `own-site.ts` and `india-topics.ts` regexes unchanged so existing rows keep their classification.

### Phase 2 — Backfill Bay Area Indian community sources
1. Add more English-language Indian-American/Bay Area sources to the news pipeline:
   - Local Bay Area Indian community publishers (e.g., India Currents, local event calendars).
   - Municipal/city news feeds for Bay Area cities already in `CITY_GUIDE_FEEDS`.
   - Expand Google News sweeps for `"Bay Area Indian community"`, `"Indian Americans Bay Area"`, etc.
2. Keep cinema/OTT/glamour sources that are not on `telugutimes.net`.
3. Ensure new sources flow through canonical deduplication and English-only gate.

### Phase 3 — Replace fake property listings
1. Add a clear disclaimer/"Sponsored editorial" label to `/property`, `/nri-real-estate`, and `/credai-show`.
2. Replace fabricated project details in `src/data/credaiShowData.ts` and `src/data/nriProperties.ts` with neutral "contact for details" placeholders where real RERA/pricing cannot be verified.
3. Remove obviously fake RERA numbers (`P0240000XXXX`, `P0240000YYYY`).
4. Link property pages to a moderated claim/submission flow so real agents can supply verified data.

### Phase 4 — Migrate temple directory to real OSM data
1. Keep existing hardcoded temples as fallback but mark them as needing verification.
2. Ingest Hindu temples from `directory_entities` (`category='religious', subcategory='hindu-temples'`) into a new `temples` table or merge with existing `temple_sources`.
3. Update `/temples` to query the DB first, falling back to hardcoded data only when DB has no local match.

### Phase 5 — Promote submissions and directory
1. Add prominent "Submit a story" / "Add a listing" links to the homepage, header, and mobile bottom tab bar.
2. Add a "Local Directory" shortcut to the top navigation and mobile tab bar.
3. Ensure `/directory` and `/submit` are linked from footer and "More" menu.

### Phase 6 — Clean up Gen Z / Glamour placeholders
1. Replace `src/data/glamour-placeholders.ts` with a family-friendly, empty/curated state until real photos are approved.
2. Keep `src/lib/genz-data.ts` sample flag but downgrade its prominence on homepage until real content replaces it.

### Phase 7 — Verify and test
1. Run `bunx tsgo --noEmit` and ensure build passes.
2. Run manual collection hooks for news and India ingest to confirm TeluguTimes is no longer pulled.
3. Check preview for navigation, directory, and submission links.
4. Update `roadmap.md` to mark completed items.

## Out of scope (preserved)
- Existing hero, sponsor carousel, HousingHero, Smart Digest, Glamour pocket rotation, forums, auth, and automated ingestion infrastructure.
- Backend WordPress asset URLs (images/epaper) used by property showcase pages.
- Existing community/associations deletion already completed.
