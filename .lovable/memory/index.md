# Project Memory

## Core
- Site brand: "Bay Area Telugu Times". Tagline in English only, no Telugu.
- Homepage baseline: hero-size glamour photo under the banner, rotating continuously (20s cycle, slots staggered). Never remove.
- Homepage top slot is a COMPACT curated story slider (never a billboard): mobile ~320px, desktop ~460px / max 58vh, 6s slides.
- Never sign the editor out automatically — only the explicit Sign out button ends a session.
- Never repeat a story, source URL, or photo across homepage sections; deduplication is a release checklist rule.
- Image selection is never random: least-recently-used + relevance + quality + subject diversity.
- **Baseline frozen 2026-08-15:** all currently working features (homepage hero, menus, desk, publishing, auth, collection, Glamour rules) must be preserved. Do not revert, remove, or weaken them in future edits.
- News publishes without editor approval; every story has like/dislike icons and a dislike deletes it site-wide (readers hide locally).
- Pictures auto-publish to the Glamour folder only when they read as a single woman; group/unclear photos wait in the picture desk.
- Picture collection runs continuously; the live Glamour folder is one pocket of ~50 photos, extra photos wait in the archive and the next pocket is called in once the live one is fully used.

## Memories
- [Tagline](mem://design/tagline) — Official site tagline and copy voice
- [Stay signed in](mem://preferences/stay-signed-in) — Auth guard must trust stored session, no auto sign-out
- [Content deduplication](mem://features/content-deduplication) — Enforce duplicate checks at ingest, read, and homepage-section levels
- [Glamour pockets and archive](mem://features/glamour-archive) — 50-photo live pocket, archive pockets, swap-on-exhaustion, pushed intake
- [Production baseline](mem://baseline) — Frozen feature set; future changes must not regress these capabilities
- [Compact hero and image lifecycle](mem://memory/hero-and-images) — Hero sizing/timing, image-use registry rest windows, News/Event/FunZone classification
