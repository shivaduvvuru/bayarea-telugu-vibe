---
name: Compact hero and image lifecycle
description: Homepage hero size, 6s story slider rules, and the central image-use registry (LRU, rest windows, subject diversity)
type: feature
---
- Homepage hero is a curated STORY slider (max 5 slides), not a photo slideshow: mobile 320px (300-360), desktop 460px capped at min(500px, 58vh).
- Slide interval 6s, 600ms cross-fade; pauses on hover, touch and hidden tab; arrows (desktop), swipe (mobile), dots.
- Selection is deterministic — never random. Score = Bay Area relevance + reader interest + freshness + artwork quality, then least-recently-used artwork, then one story per subject for diversity (`src/lib/hero-select.ts`).
- Image lifecycle lives in `src/lib/image-usage.ts`: hero images rest 7 days, feature 4 days, grid 12h; a claim set stops the same image printing twice on one page render.
- Content classification (`src/lib/classify.ts`): NEWS = happened/announced, EVENT = attendable future date, FUNZONE = enjoyable to attend/watch/eat. Temple/association upcoming → Events (+Community); after-event coverage → Community news; restaurant openings → Food/Business; restaurant shows/food festivals → Events + FunZone.
- Homepage "Happening soon" is compact and chronological (Today → Tomorrow → This weekend → Coming soon); events drop off after their own day, they are never deleted.
