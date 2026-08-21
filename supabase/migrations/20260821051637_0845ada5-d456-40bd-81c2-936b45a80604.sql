CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

INSERT INTO public.hook_tokens (name) VALUES ('ingest-sources')
ON CONFLICT (name) DO NOTHING;

DO $$
BEGIN
  PERFORM cron.unschedule('times-bayarea-ingest-sources');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'times-bayarea-ingest-sources',
  '*/20 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--21d2eeed-01e3-4e0e-a028-88e01859acea.lovable.app/api/public/hooks/ingest-sources',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_2FXbc9YU06WXqkqZvEMbmA_2SuuWt0v'
    ),
    body := jsonb_build_object('budgetMs', 60000)
  );
  $$
);