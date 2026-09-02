CREATE TABLE public.articles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_item_id uuid REFERENCES public.content_items(id) ON DELETE SET NULL,
  title text NOT NULL,
  summary text,
  summary_bullets jsonb NOT NULL DEFAULT '[]'::jsonb,
  desk text NOT NULL,
  city text,
  source_name text,
  source_url text,
  image_url text,
  importance_score numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published',
  published_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX articles_content_item_uidx ON public.articles(content_item_id) WHERE content_item_id IS NOT NULL;
CREATE INDEX articles_desk_published_idx ON public.articles(desk, published_at DESC) WHERE status = 'published';
CREATE INDEX articles_importance_idx ON public.articles(importance_score DESC) WHERE status = 'published';

GRANT SELECT ON public.articles TO anon;
GRANT SELECT ON public.articles TO authenticated;
GRANT ALL ON public.articles TO service_role;

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published articles are public" ON public.articles
  FOR SELECT USING (status = 'published');

CREATE POLICY "Staff manage articles" ON public.articles
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER articles_touch_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

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
  CASE
    WHEN ci.resolved_category IN ('cinema', 'gallery', 'micro-drama') THEN 'cinema-glamour'
    WHEN ci.is_local THEN 'bay-area'
    WHEN ci.resolved_category = 'india-news' THEN 'telangana-andhra'
    ELSE 'bay-area'
  END,
  ci.city,
  COALESCE(ci.source_names[1], ci.source),
  COALESCE(ci.link_url, ci.source_ref),
  ci.image_url,
  COALESCE(ci.priority_score, 0),
  'published',
  COALESCE(ci.published_at, ci.created_at)
FROM public.content_items ci
WHERE ci.status = 'published'
  AND ci.placement <> 'hidden'
  AND ci.kind = 'news'
ORDER BY COALESCE(ci.published_at, ci.created_at) DESC
LIMIT 500
ON CONFLICT DO NOTHING;