-- Guarantee no two live stories share a canonical link or a publisher headline,
-- regardless of which code path inserts them.
CREATE UNIQUE INDEX IF NOT EXISTS content_items_canonical_url_live_uidx
  ON public.content_items (canonical_url)
  WHERE status <> 'duplicate' AND canonical_url IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS content_items_source_norm_title_live_uidx
  ON public.content_items (source, norm_title)
  WHERE status <> 'duplicate' AND norm_title IS NOT NULL;

-- Audit screen reads duplicates newest-first.
CREATE INDEX IF NOT EXISTS content_items_duplicate_of_idx
  ON public.content_items (duplicate_of, created_at DESC)
  WHERE status = 'duplicate';