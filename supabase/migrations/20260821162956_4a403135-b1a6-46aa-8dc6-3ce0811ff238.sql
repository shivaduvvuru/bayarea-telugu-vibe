-- Automatic publishing schedule: give the collectors a real time budget and add
-- a short-interval publish pass so every collected, de-duplicated item goes live.

SELECT cron.unschedule('collect-news-hourly');
SELECT cron.unschedule('collect-gallery-continuous');
SELECT cron.unschedule('times-bayarea-ingest-sources');

SELECT cron.schedule(
  'collect-news-every-20-min',
  '*/20 * * * *',
  $$
  SELECT net.http_post(
    url:='https://project--21d2eeed-01e3-4e0e-a028-88e01859acea.lovable.app/api/public/hooks/collect-news',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||public.hook_token('ingest')),
    body:='{}'::jsonb,
    timeout_milliseconds:=120000
  ) as request_id;
  $$
);

SELECT cron.schedule(
  'collect-gallery-continuous',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url:='https://project--21d2eeed-01e3-4e0e-a028-88e01859acea.lovable.app/api/public/hooks/collect-news',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||public.hook_token('ingest')),
    body:='{"mode":"gallery"}'::jsonb,
    timeout_milliseconds:=120000
  ) as request_id;
  $$
);

SELECT cron.schedule(
  'times-bayarea-ingest-sources',
  '*/20 * * * *',
  $$
  SELECT net.http_post(
    url:='https://project--21d2eeed-01e3-4e0e-a028-88e01859acea.lovable.app/api/public/hooks/ingest-sources',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||public.hook_token('ingest')),
    body:='{}'::jsonb,
    timeout_milliseconds:=120000
  ) as request_id;
  $$
);

SELECT cron.schedule(
  'publish-news-backlog',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://project--21d2eeed-01e3-4e0e-a028-88e01859acea.lovable.app/api/public/hooks/publish-news',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||public.hook_token('ingest')),
    body:='{}'::jsonb,
    timeout_milliseconds:=60000
  ) as request_id;
  $$
);