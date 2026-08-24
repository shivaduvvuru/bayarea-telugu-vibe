SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname IN ('india-ingest-20m','ingest-health-audit-daily','ingest-weekly-digest');

SELECT cron.schedule(
  'india-ingest-20m',
  '7,27,47 * * * *',
  $$
  SELECT net.http_post(
    url:='https://project--21d2eeed-01e3-4e0e-a028-88e01859acea.lovable.app/api/public/hooks/india-ingest',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||public.hook_token('ingest')),
    body:='{"trigger":"cron","budgetMs":90000}'::jsonb,
    timeout_milliseconds:=120000
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'ingest-health-audit-daily',
  '0 14 * * *',
  $$
  SELECT net.http_post(
    url:='https://project--21d2eeed-01e3-4e0e-a028-88e01859acea.lovable.app/api/public/hooks/health-audit',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||public.hook_token('ingest')),
    body:='{"mode":"daily"}'::jsonb,
    timeout_milliseconds:=180000
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'ingest-weekly-digest',
  '5 14 * * 1',
  $$
  SELECT net.http_post(
    url:='https://project--21d2eeed-01e3-4e0e-a028-88e01859acea.lovable.app/api/public/hooks/health-audit',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||public.hook_token('ingest')),
    body:='{"mode":"weekly"}'::jsonb,
    timeout_milliseconds:=120000
  ) AS request_id;
  $$
);