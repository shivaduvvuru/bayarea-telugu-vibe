CREATE TABLE public.ingest_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  mode text NOT NULL,
  source text NOT NULL,
  category text,
  status text NOT NULL,
  items_found integer NOT NULL DEFAULT 0,
  items_inserted integer NOT NULL DEFAULT 0,
  error text,
  trigger text NOT NULL DEFAULT 'cron',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ingest_runs TO authenticated;
GRANT ALL ON public.ingest_runs TO service_role;

ALTER TABLE public.ingest_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read ingest runs"
  ON public.ingest_runs FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE INDEX ingest_runs_finished_idx ON public.ingest_runs (finished_at DESC);
CREATE INDEX ingest_runs_source_idx ON public.ingest_runs (source, finished_at DESC);
CREATE INDEX ingest_runs_mode_idx ON public.ingest_runs (mode, finished_at DESC);