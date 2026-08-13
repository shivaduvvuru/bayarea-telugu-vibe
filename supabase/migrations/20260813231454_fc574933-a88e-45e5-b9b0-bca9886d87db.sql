select cron.schedule(
  'collect-gallery-3h',
  '20 */3 * * *',
  $$
  SELECT net.http_post(
    url:='https://project--21d2eeed-01e3-4e0e-a028-88e01859acea.lovable.app/api/public/hooks/collect-news',
    headers:='{"Content-Type": "application/json", "apikey": "sb_publishable_2FXbc9YU06WXqkqZvEMbmA_2SuuWt0v"}'::jsonb,
    body:='{"mode":"gallery"}'::jsonb
  ) as request_id;
  $$
);