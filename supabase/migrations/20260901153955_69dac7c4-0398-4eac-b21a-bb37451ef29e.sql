select cron.schedule(
  'new-india-abroad-daily',
  '0 8 * * *',
  $$
    SELECT net.http_post(
      url := 'https://project--21d2eeed-01e3-4e0e-a028-88e01859acea.lovable.app/api/public/hooks/syndicate',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || public.hook_token('ingest')
      ),
      body := '{"trigger":"cron"}'::jsonb,
      timeout_milliseconds := 120000
    ) AS request_id;
  $$
);