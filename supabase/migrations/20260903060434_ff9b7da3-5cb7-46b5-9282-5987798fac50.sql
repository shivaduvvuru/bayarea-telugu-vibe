GRANT SELECT ON public.articles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.articles TO authenticated;
GRANT ALL ON public.articles TO service_role;

-- Scrub internal editorial notes that leaked into public summaries.
UPDATE public.content_items
SET summary = NULL
WHERE summary ILIKE '%before publishing%' OR summary ILIKE '%Verify details%';

UPDATE public.articles
SET summary = NULL
WHERE summary ILIKE '%before publishing%' OR summary ILIKE '%Verify details%';

UPDATE public.articles
SET summary_bullets = '[]'::jsonb
WHERE summary_bullets::text ILIKE '%before publishing%' OR summary_bullets::text ILIKE '%Verify details%';