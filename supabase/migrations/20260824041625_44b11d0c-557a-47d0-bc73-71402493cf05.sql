SELECT cron.unschedule('directory-ingest-hourly');
SELECT cron.schedule(
  'directory-ingest-hourly',
  '35 * * * *',
  $$
  SELECT net.http_post(
    url:='https://project--21d2eeed-01e3-4e0e-a028-88e01859acea.lovable.app/api/public/hooks/directory-ingest',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||public.hook_token('ingest')),
    body:='{"trigger":"cron","mode":"burst","maxQueries":6}'::jsonb,
    timeout_milliseconds:=120000
  ) AS request_id;
  $$
);