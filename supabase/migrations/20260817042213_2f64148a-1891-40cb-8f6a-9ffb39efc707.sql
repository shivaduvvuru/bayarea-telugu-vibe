SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname IN ('collect-gallery-3h','collect-gallery-5m','collect-gallery-continuous');

SELECT cron.schedule(
  'collect-gallery-continuous',
  '* * * * *',
  $job$
  SELECT net.http_post(
    url:='https://project--21d2eeed-01e3-4e0e-a028-88e01859acea.lovable.app/api/public/hooks/collect-news',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||public.hook_token('ingest')),
    body:='{"mode":"gallery"}'::jsonb
  ) as request_id;
  $job$
);