UPDATE public.content_items
SET published_at = now(), status = 'published'
WHERE category = 'gallery'
  AND source_ref LIKE 'editorial-desk:gal-%'
  AND status IN ('published','archived')
  AND created_at > now() - interval '6 hours';