CREATE TABLE public.directory_slice_fingerprints (
  slice text PRIMARY KEY,
  fingerprint text NOT NULL,
  element_count integer NOT NULL DEFAULT 0,
  checked_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.directory_slice_fingerprints TO service_role;
ALTER TABLE public.directory_slice_fingerprints ENABLE ROW LEVEL SECURITY;

SELECT cron.unschedule('directory-ingest-hourly');
SELECT cron.schedule(
  'directory-ingest-6h',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url:='https://project--21d2eeed-01e3-4e0e-a028-88e01859acea.lovable.app/api/public/hooks/directory-ingest',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||public.hook_token('ingest')),
    body:='{"trigger":"cron"}'::jsonb,
    timeout_milliseconds:=120000
  ) AS request_id;
  $$
);