-- Hide duplicate published stories (same headline key, same link, or same image);
-- the oldest row of each group stays visible.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY coalesce(nullif(dedupe_key,''), lower(regexp_replace(title, '[^a-zA-Z0-9]', '', 'g')))
           ORDER BY coalesce(published_at, created_at) ASC, created_at ASC
         ) AS rn
  FROM public.content_items
  WHERE status = 'published' AND placement <> 'hidden'
)
UPDATE public.content_items c SET placement = 'hidden'
FROM ranked r WHERE c.id = r.id AND r.rn > 1;

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY lower(split_part(link_url, '?', 1))
           ORDER BY coalesce(published_at, created_at) ASC, created_at ASC
         ) AS rn
  FROM public.content_items
  WHERE status = 'published' AND placement <> 'hidden' AND link_url IS NOT NULL
)
UPDATE public.content_items c SET placement = 'hidden'
FROM ranked r WHERE c.id = r.id AND r.rn > 1;

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY lower(split_part(image_url, '?', 1))
           ORDER BY coalesce(published_at, created_at) ASC, created_at ASC
         ) AS rn
  FROM public.content_items
  WHERE status = 'published' AND placement <> 'hidden' AND image_url IS NOT NULL
)
UPDATE public.content_items c SET placement = 'hidden'
FROM ranked r WHERE c.id = r.id AND r.rn > 1;