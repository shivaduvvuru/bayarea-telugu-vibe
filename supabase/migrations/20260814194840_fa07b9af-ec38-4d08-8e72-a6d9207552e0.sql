CREATE TABLE IF NOT EXISTS public.hook_tokens (
  name text PRIMARY KEY,
  token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.hook_tokens FROM anon, authenticated;
GRANT ALL ON public.hook_tokens TO service_role;
ALTER TABLE public.hook_tokens ENABLE ROW LEVEL SECURITY;

INSERT INTO public.hook_tokens (name) VALUES ('ingest') ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.hook_token(_name text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$ SELECT token FROM public.hook_tokens WHERE name = _name $fn$;
REVOKE ALL ON FUNCTION public.hook_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hook_token(text) FROM anon;
REVOKE ALL ON FUNCTION public.hook_token(text) FROM authenticated;

SELECT cron.unschedule('collect-news-hourly');
SELECT cron.schedule(
  'collect-news-hourly',
  '5 * * * *',
  $job$
  SELECT net.http_post(
    url:='https://project--21d2eeed-01e3-4e0e-a028-88e01859acea.lovable.app/api/public/hooks/collect-news',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||public.hook_token('ingest')),
    body:='{}'::jsonb
  ) as request_id;
  $job$
);

SELECT cron.unschedule('collect-gallery-3h');
SELECT cron.schedule(
  'collect-gallery-3h',
  '*/30 * * * *',
  $job$
  SELECT net.http_post(
    url:='https://project--21d2eeed-01e3-4e0e-a028-88e01859acea.lovable.app/api/public/hooks/collect-news',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||public.hook_token('ingest')),
    body:='{"mode":"gallery"}'::jsonb
  ) as request_id;
  $job$
);

DROP POLICY IF EXISTS "desk open read" ON public.digest_queue;
DROP POLICY IF EXISTS "desk open update" ON public.digest_queue;
REVOKE ALL ON public.digest_queue FROM anon;

DROP POLICY IF EXISTS "Anyone can read collection run status" ON public.collect_runs;
REVOKE ALL ON public.collect_runs FROM anon;
CREATE POLICY "Staff can read collection run status"
  ON public.collect_runs FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));