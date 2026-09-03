DELETE FROM public.content_items
WHERE status IN ('published', 'pending')
  AND (
    lower(coalesce(title, '')) ~ '(placeholder|sample story|demo story|test story|lorem ipsum)'
    OR lower(coalesce(summary, '')) ~ '(placeholder|sample story|demo story|test story|lorem ipsum)'
    OR lower(coalesce(body, '')) ~ '(placeholder|sample story|demo story|test story|lorem ipsum)'
  );