-- collect_runs already exists; extend it for the per-desk cinema job.
ALTER TABLE public.collect_runs
  ADD COLUMN IF NOT EXISTS desk text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.collect_runs ALTER COLUMN finished_at DROP NOT NULL;

CREATE INDEX IF NOT EXISTS collect_runs_open_idx
  ON public.collect_runs (mode, started_at DESC)
  WHERE finished_at IS NULL;

-- staff read, service role write
GRANT SELECT ON public.collect_runs TO authenticated;
GRANT ALL ON public.collect_runs TO service_role;

ALTER TABLE public.collect_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read collect runs" ON public.collect_runs;
CREATE POLICY "Staff can read collect runs"
  ON public.collect_runs FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- Cinema/OTT + micro-drama now has its own hook. Repoint the existing cinema
-- job (it previously called collect-news with mode=cinema) and offset it 15
-- minutes from the news job (*/20 at 0,20,40) so the two never overlap.
-- The secret is read server-side from public.hook_tokens, never inlined here.
SELECT cron.unschedule('collect-cinema-30m')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'collect-cinema-30m');

SELECT cron.schedule(
  'collect-cinema-desk-30m',
  '15,45 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--21d2eeed-01e3-4e0e-a028-88e01859acea.lovable.app/api/public/hooks/collect-cinema',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || public.hook_token('ingest')),
    body := '{"trigger":"cron"}'::jsonb,
    timeout_milliseconds := 240000
  ) AS request_id;
  $$
);