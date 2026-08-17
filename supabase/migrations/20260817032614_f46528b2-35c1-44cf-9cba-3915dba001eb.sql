-- Test intake: one couple shot (must wait in the picture desk) and one solo woman
-- portrait (must auto-approve into the Glamour folder).
insert into public.digest_queue (item_id, dedupe_key, digest_date, kind, city_slug, title, summary, source, source_url, published_at, origin, payload, status, upload_status)
values
 ('gal-test-couple-001', 'test-couple-001', current_date, 'news', 'bay-area',
  'Samantha Ruth Prabhu and husband Raj Nidimoru pose together at the airport',
  'The couple was spotted arriving in Mumbai.', 'TOI entertainment photos',
  'https://timesofindia.indiatimes.com/entertainment/telugu/photos/test-couple/photostory/133290001.cms',
  now(), 'feed',
  jsonb_build_object('gallery', true, 'kind','news','citySlug','bay-area','image','https://static.toiimg.com/photo/msid-133284681,imgsize-116131.cms','sourceUrl','https://timesofindia.indiatimes.com/entertainment/telugu/photos/test-couple/photostory/133290001.cms','source','TOI entertainment photos'),
  'pending', 'none'),
 ('gal-test-solo-001', 'test-solo-001', current_date, 'news', 'bay-area',
  'Rashmika Mandanna stuns in a golden saree at the photoshoot',
  'The actress shared solo pictures from her latest glamour photoshoot.', 'TOI entertainment photos',
  'https://timesofindia.indiatimes.com/entertainment/telugu/photos/test-solo/photostory/133290002.cms',
  now(), 'feed',
  jsonb_build_object('gallery', true, 'kind','news','citySlug','bay-area','image','https://static.toiimg.com/photo/msid-133284347,imgsize-251899.cms','sourceUrl','https://timesofindia.indiatimes.com/entertainment/telugu/photos/test-solo/photostory/133290002.cms','source','TOI entertainment photos'),
  'approved', 'sent')
on conflict (dedupe_key) do nothing;

insert into public.content_items (source, source_ref, kind, title, summary, link_url, image_url, city, region, category, dedupe_key, status, placement, published_at)
values ('editorial-desk:TOI entertainment photos', 'editorial-desk:gal-test-solo-001', 'news',
  'Rashmika Mandanna stuns in a golden saree at the photoshoot',
  'The actress shared solo pictures from her latest glamour photoshoot.',
  'https://timesofindia.indiatimes.com/entertainment/telugu/photos/test-solo/photostory/133290002.cms',
  'https://static.toiimg.com/photo/msid-133284347,imgsize-251899.cms',
  'Bay Area', null, 'gallery', 'rashmika-mandanna-stuns-in-a-golden-saree-at-the-photoshoot',
  'published', 'auto', now())
on conflict (source_ref) do nothing;