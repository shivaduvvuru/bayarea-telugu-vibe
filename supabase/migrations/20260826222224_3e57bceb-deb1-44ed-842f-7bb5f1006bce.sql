ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS last_shown_at timestamptz;
CREATE INDEX IF NOT EXISTS content_items_gallery_last_shown_idx
  ON public.content_items (last_shown_at NULLS FIRST)
  WHERE category = 'gallery';