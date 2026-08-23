ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS resolved_category text,
  ADD COLUMN IF NOT EXISTS is_local boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS content_items_resolved_category_published_idx
  ON public.content_items (resolved_category, published_at DESC)
  WHERE status = 'published' AND placement <> 'hidden';

CREATE INDEX IF NOT EXISTS content_items_local_published_idx
  ON public.content_items (published_at DESC)
  WHERE status = 'published' AND placement <> 'hidden' AND is_local;