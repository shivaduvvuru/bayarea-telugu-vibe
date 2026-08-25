UPDATE public.content_items
SET resolved_category = 'cinema', category = 'cinema', is_local = false, updated_at = now()
WHERE link_url ILIKE '%telugutimes.net/en/cinemas%'
  AND coalesce(resolved_category, '') <> 'cinema';