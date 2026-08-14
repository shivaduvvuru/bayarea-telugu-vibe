CREATE TABLE public.collect_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mode text NOT NULL,
  trigger text NOT NULL DEFAULT 'cron',
  collected integer NOT NULL DEFAULT 0,
  published integer NOT NULL DEFAULT 0,
  held integer NOT NULL DEFAULT 0,
  duplicates_hidden integer NOT NULL DEFAULT 0,
  ok boolean NOT NULL DEFAULT true,
  error text,
  finished_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.collect_runs TO anon;
GRANT SELECT ON public.collect_runs TO authenticated;
GRANT ALL ON public.collect_runs TO service_role;
ALTER TABLE public.collect_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read collection run status" ON public.collect_runs FOR SELECT USING (true);
CREATE INDEX collect_runs_finished_at_idx ON public.collect_runs (finished_at DESC);