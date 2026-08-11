UPDATE public.content_items
SET title = btrim(regexp_replace(title, '^(?:[Pp]atch\s*(?:AM|PM|am|pm)|SF|SJ|NYC)\s*:\s*', '')),
    image_url = CASE WHEN title ~* '^(?:patch\s*(?:am|pm))\s*:' THEN NULL ELSE image_url END
WHERE title ~* '^(?:patch\s*(?:am|pm)|SF|SJ|NYC)\s*:';

UPDATE public.digest_queue
SET title = btrim(regexp_replace(title, '^(?:[Pp]atch\s*(?:AM|PM|am|pm)|SF|SJ|NYC)\s*:\s*', '')),
    payload = CASE WHEN source ~* 'patch' OR title ~* '^patch\s*(?:am|pm)\s*:' THEN payload - 'image' ELSE payload END
WHERE title ~* '^(?:patch\s*(?:am|pm)|SF|SJ|NYC)\s*:' OR source ~* 'patch';