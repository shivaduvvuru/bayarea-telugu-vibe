CREATE TABLE public.url_resolutions (
  google_url text PRIMARY KEY,
  resolved_url text,
  resolved_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.url_resolutions TO service_role;

ALTER TABLE public.url_resolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages url resolutions"
  ON public.url_resolutions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');