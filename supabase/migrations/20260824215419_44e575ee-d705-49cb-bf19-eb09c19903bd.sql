CREATE TABLE public.summary_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  trigger text NOT NULL DEFAULT 'cron',
  calls integer NOT NULL DEFAULT 0,
  batches integer NOT NULL DEFAULT 0,
  fallback_calls integer NOT NULL DEFAULT 0,
  items_summarized integer NOT NULL DEFAULT 0,
  items_skipped integer NOT NULL DEFAULT 0,
  malformed_batches integer NOT NULL DEFAULT 0,
  missing_entries integer NOT NULL DEFAULT 0,
  unknown_entries integer NOT NULL DEFAULT 0,
  unresolved integer NOT NULL DEFAULT 0,
  retries integer NOT NULL DEFAULT 0,
  throttled integer NOT NULL DEFAULT 0,
  avg_batch_size numeric NOT NULL DEFAULT 0,
  truncation_rate numeric NOT NULL DEFAULT 0,
  warnings text[] NOT NULL DEFAULT '{}'
);

GRANT SELECT ON public.summary_runs TO authenticated;
GRANT ALL ON public.summary_runs TO service_role;

ALTER TABLE public.summary_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read summary runs"
ON public.summary_runs FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE INDEX summary_runs_created_at_idx ON public.summary_runs (created_at DESC);