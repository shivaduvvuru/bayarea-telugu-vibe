SELECT cron.schedule(
  'times-bayarea-ingest-oneshot',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--21d2eeed-01e3-4e0e-a028-88e01859acea-dev.lovable.app/api/public/hooks/ingest-sources',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.hook_token('ingest')
    ),
    body := jsonb_build_object('budgetMs', 50000)
  );
  $$
);