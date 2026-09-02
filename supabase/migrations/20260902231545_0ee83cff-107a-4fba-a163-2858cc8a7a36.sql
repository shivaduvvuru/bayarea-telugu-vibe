-- Re-file existing rows using the correct desk mapping.
UPDATE public.articles a
SET desk = CASE
    WHEN ci.resolved_category IN ('cinema', 'gallery', 'micro-drama') THEN 'cinema-glamour'
    WHEN ci.resolved_category IN ('india-telangana', 'india-andhra') THEN 'telangana-andhra'
    ELSE 'bay-area'
  END
FROM public.content_items ci
WHERE ci.id = a.content_item_id
  AND a.desk IS DISTINCT FROM CASE
    WHEN ci.resolved_category IN ('cinema', 'gallery', 'micro-drama') THEN 'cinema-glamour'
    WHEN ci.resolved_category IN ('india-telangana', 'india-andhra') THEN 'telangana-andhra'
    ELSE 'bay-area'
  END;

-- Top up each desk with its most recent published stories.
INSERT INTO public.articles (
  content_item_id, title, summary, summary_bullets, desk, city,
  source_name, source_url, image_url, importance_score, status, published_at
)
SELECT
  ci.id,
  ci.title,
  ci.summary,
  COALESCE(
    (SELECT jsonb_agg(b) FROM (
      SELECT unnest(ARRAY[ci.summary, ci.why_it_matters, ci.what_to_do]) AS b
    ) t WHERE b IS NOT NULL AND length(btrim(b)) > 0),
    '[]'::jsonb
  ),
  ci.desk,
  ci.city,
  COALESCE(ci.source_names[1], ci.source),
  COALESCE(ci.link_url, ci.source_ref),
  ci.image_url,
  COALESCE(ci.priority_score, 0),
  'published',
  COALESCE(ci.published_at, ci.created_at)
FROM (
  SELECT c.*,
    CASE
      WHEN c.resolved_category IN ('cinema', 'gallery', 'micro-drama') THEN 'cinema-glamour'
      WHEN c.resolved_category IN ('india-telangana', 'india-andhra') THEN 'telangana-andhra'
      WHEN c.is_local THEN 'bay-area'
      ELSE NULL
    END AS desk,
    row_number() OVER (
      PARTITION BY CASE
        WHEN c.resolved_category IN ('cinema', 'gallery', 'micro-drama') THEN 'cinema-glamour'
        WHEN c.resolved_category IN ('india-telangana', 'india-andhra') THEN 'telangana-andhra'
        WHEN c.is_local THEN 'bay-area'
        ELSE NULL
      END
      ORDER BY COALESCE(c.published_at, c.created_at) DESC
    ) AS rn
  FROM public.content_items c
  WHERE c.status = 'published' AND c.placement <> 'hidden' AND c.kind = 'news'
) ci
WHERE ci.desk IS NOT NULL
  AND ci.rn <= 100
  AND NOT EXISTS (SELECT 1 FROM public.articles a WHERE a.content_item_id = ci.id);