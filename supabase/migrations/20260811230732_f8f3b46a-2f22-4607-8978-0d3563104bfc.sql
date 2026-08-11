UPDATE public.content_items SET image_url = NULL WHERE image_url ILIKE '%patch%';
UPDATE public.digest_queue SET payload = payload - 'image' WHERE payload->>'image' ILIKE '%patch%';