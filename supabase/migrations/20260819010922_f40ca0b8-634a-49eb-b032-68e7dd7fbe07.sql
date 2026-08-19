ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS people_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS people_count integer;

CREATE INDEX IF NOT EXISTS content_items_people_check_idx
  ON public.content_items (category, people_checked_at);