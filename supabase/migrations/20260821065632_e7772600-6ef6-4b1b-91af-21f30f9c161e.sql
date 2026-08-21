SELECT cron.schedule(
  'temple-calendar-twice-daily',
  '15 13,23 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--21d2eeed-01e3-4e0e-a028-88e01859acea.lovable.app/api/public/hooks/temple-calendar',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.hook_token('ingest')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

SELECT net.http_post(
  url := 'https://project--21d2eeed-01e3-4e0e-a028-88e01859acea.lovable.app/api/public/hooks/temple-calendar',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || public.hook_token('ingest')
  ),
  body := '{}'::jsonb
);