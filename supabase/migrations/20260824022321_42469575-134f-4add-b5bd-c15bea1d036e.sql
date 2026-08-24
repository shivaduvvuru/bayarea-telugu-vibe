CREATE TABLE public.directory_ingest_state (
  id text PRIMARY KEY DEFAULT 'osm',
  cursor_index integer NOT NULL DEFAULT 0,
  total_slices integer NOT NULL DEFAULT 0,
  last_slice text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.directory_ingest_state TO service_role;

ALTER TABLE public.directory_ingest_state ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER directory_ingest_state_touch
BEFORE UPDATE ON public.directory_ingest_state
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.directory_ingest_state (id) VALUES ('osm')
ON CONFLICT (id) DO NOTHING;

SELECT cron.schedule(
  'directory-ingest-hourly',
  '35 * * * *',
  $$
  SELECT net.http_post(
    url:='https://project--21d2eeed-01e3-4e0e-a028-88e01859acea.lovable.app/api/public/hooks/directory-ingest',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||public.hook_token('ingest')),
    body:='{"trigger":"cron"}'::jsonb
  ) AS request_id;
  $$
);