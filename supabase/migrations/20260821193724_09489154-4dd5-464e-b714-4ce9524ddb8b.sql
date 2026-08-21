CREATE TABLE public.headline_picks (
  slot TEXT PRIMARY KEY,
  content_id UUID REFERENCES public.content_items(id) ON DELETE CASCADE,
  label TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.headline_picks TO anon;
GRANT SELECT ON public.headline_picks TO authenticated;
GRANT ALL ON public.headline_picks TO service_role;

ALTER TABLE public.headline_picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Headline picks are public to read"
ON public.headline_picks FOR SELECT
TO anon, authenticated
USING (true);