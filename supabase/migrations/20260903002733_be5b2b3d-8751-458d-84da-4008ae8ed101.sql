-- A partial unique index cannot back an ON CONFLICT (content_item_id) upsert
-- through the Data API, so every mirror write failed. A plain unique index
-- still allows many NULL rows (NULLs are distinct) and supports the upsert.
DROP INDEX IF EXISTS public.articles_content_item_id_key;
DROP INDEX IF EXISTS public.articles_content_item_id_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS articles_content_item_id_unique
  ON public.articles (content_item_id);