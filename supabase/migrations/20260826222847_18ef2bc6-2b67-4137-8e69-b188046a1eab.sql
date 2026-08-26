DROP INDEX IF EXISTS public.content_items_gallery_last_shown_idx;
CREATE INDEX IF NOT EXISTS content_items_gallery_last_shown_idx
  ON public.content_items (last_shown_at NULLS FIRST)
  WHERE resolved_category = 'gallery';