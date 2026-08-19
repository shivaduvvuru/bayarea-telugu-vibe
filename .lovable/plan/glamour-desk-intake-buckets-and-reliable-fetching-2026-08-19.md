# Glamour Desk intake buckets and reliable fetching

## Goal
Turn the Glamour picture desk into a complete, paginated intake workspace where every collected candidate has a visible lifecycle, safety blocks can be reviewed, and a collection request always finishes with clear feedback.

## What will change

### 1. Persist the complete picture intake lifecycle
- Add a staff-only `picture_intake` table that records each candidate image, source metadata, dedupe key, current stage, safety reason, screening state, and timestamps.
- Stages will cover `discovered`, `usable`, `pending`, `approved`, `rejected`, `safety_blocked`, and `duplicate`.
- Keep the existing `digest_queue` as the publishing queue; `picture_intake` becomes the durable audit/index used by Desk buckets.
- Backfill available picture records from the current queue and rejection history where image details still exist.
- Apply explicit backend grants and row-level security so the table remains inaccessible to public visitors and is available only through the passcode-protected Desk server functions.

### 2. Remove the ingestion bottleneck
- Record candidates before visual screening instead of losing rejected rows after aggregate counters are written.
- Process screening in bounded chunks and persist progress after each chunk, so a timeout cannot discard the entire intake run.
- Send every usable, non-duplicate candidate to `pending`; safety-blocked candidates remain visible in their own bucket instead of entering permanent duplicate suppression.
- Keep definitive duplicates blocked from re-collection, preserving the frozen no-repeat rule.
- Return structured collection results with discovered, usable, pending, blocked, duplicate, and failed counts.

### 3. Add live, clickable Desk buckets
- Replace the current four static cards with tabs for Ready for Review, Pending, Approved, Rejected/Discarded, Safety Blocked, and Discovered/Raw.
- Counts and results will come from one server-side filtered query so the selected tab always matches its live total.
- Safety-blocked cards will show the reason and provide an editor override that moves a false positive to Pending.
- Preserve the current photo metadata, source link, approve/reject/duplicate controls, and publishing behavior.

### 4. Add pagination and safe batch actions
- Load 24 photos per page with Previous/Next controls and total/page indicators; changing a bucket resets to page one.
- Add item selection and scoped Bulk Approve, Bulk Reject, and Bulk Move actions instead of applying actions to an unbounded hidden result set.
- Refresh only the affected bucket/counts after an action to keep the Desk responsive with hundreds of photos.

### 5. Make collection state reliable
- Wrap the manual fetch in a client timeout/abort guard and always reset the button in `finally`.
- Prevent the automatic low-intake recovery from competing with a manual run.
- Show success/error notifications using the structured response, and retain a visible last-run status when a request times out or partially completes.
- Remove the expensive post-fetch loop that repeatedly reloads the entire Desk; poll compact bucket counts instead.

## Technical details
- Database migration: create `public.picture_intake`, indexes for `(stage, updated_at)` and dedupe identity, grants for service operations, RLS enabled with no public policy.
- Server functions remain thin wrappers and validate passcode Desk sessions before returning or changing intake data.
- Collection stays in the existing TanStack public hook route; no separate edge function is introduced.
- The existing public Glamour publishing path and 50-photo pocket/archive behavior remain unchanged.

## Validation
- Run a gallery collection and confirm the response counts reconcile with persisted bucket totals.
- Verify usable candidates are not capped at six, blocked rows remain reviewable, and duplicate rows do not re-enter Pending.
- Exercise single and bulk approve/reject/override flows and confirm approved photos publish to Glamour.
- Verify collection success, failure, and timeout all restore the Fetch button.
- Check mobile and desktop Desk layouts with several pages of photos.
