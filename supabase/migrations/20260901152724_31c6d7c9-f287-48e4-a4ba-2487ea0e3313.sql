CREATE TABLE IF NOT EXISTS public.syndicated_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL DEFAULT 'New India Abroad',
  source_category text,
  title text NOT NULL,
  excerpt text,
  canonical_url text NOT NULL UNIQUE,
  image_url text,
  published_at timestamptz,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS syndicated_stories_recent_idx
  ON public.syndicated_stories (status, published_at DESC);

GRANT SELECT ON public.syndicated_stories TO anon;
GRANT SELECT ON public.syndicated_stories TO authenticated;
GRANT ALL ON public.syndicated_stories TO service_role;

ALTER TABLE public.syndicated_stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "syndicated_public_read" ON public.syndicated_stories;
CREATE POLICY "syndicated_public_read" ON public.syndicated_stories
  FOR SELECT TO anon, authenticated USING (status = 'published');

CREATE TABLE IF NOT EXISTS public.syndication_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL DEFAULT 'New India Abroad',
  trigger text NOT NULL DEFAULT 'cron',
  fetched_count integer NOT NULL DEFAULT 0,
  new_count integer NOT NULL DEFAULT 0,
  error text,
  elapsed_ms integer,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.syndication_runs TO service_role;
ALTER TABLE public.syndication_runs ENABLE ROW LEVEL SECURITY;