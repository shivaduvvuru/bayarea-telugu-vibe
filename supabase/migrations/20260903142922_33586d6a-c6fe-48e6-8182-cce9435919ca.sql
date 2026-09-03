-- Keep the digest's article copy in step with later newsroom edits.
CREATE OR REPLACE FUNCTION public.sync_article_from_content_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.articles a
     SET title = COALESCE(NULLIF(NEW.title, ''), a.title),
         summary = NEW.summary,
         image_url = NEW.image_url,
         city = NEW.city,
         importance_score = COALESCE(NEW.priority_score, a.importance_score),
         status = CASE
           WHEN NEW.status = 'published'
            AND COALESCE(NEW.placement, 'auto') <> 'hidden'
           THEN 'published' ELSE 'hidden' END
   WHERE a.content_item_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_article_from_content_item ON public.content_items;
CREATE TRIGGER sync_article_from_content_item
AFTER UPDATE ON public.content_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_article_from_content_item();

-- One-off reconciliation for edits made before the trigger existed.
UPDATE public.articles a
   SET status = CASE
         WHEN c.status = 'published' AND COALESCE(c.placement, 'auto') <> 'hidden'
         THEN 'published' ELSE 'hidden' END,
       summary = c.summary,
       image_url = c.image_url
  FROM public.content_items c
 WHERE c.id = a.content_item_id;

-- Refile non-local, non-India, non-film copy off the Bay Area desk.
UPDATE public.articles a
   SET desk = 'national'
  FROM public.content_items c
 WHERE c.id = a.content_item_id
   AND a.desk = 'bay-area'
   AND COALESCE(c.is_local, false) = false
   AND COALESCE(c.resolved_category, '') NOT IN ('cinema','gallery','micro-drama','india-telangana','india-andhra','india-news');