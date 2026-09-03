-- Legacy Telugu Times content removal.
CREATE TEMP TABLE tt_items AS
SELECT id FROM public.content_items
WHERE lower(coalesce(source, '')) LIKE '%telugutimes%'
   OR lower(coalesce(source, '')) LIKE '%telugu times%'
   OR lower(coalesce(source_ref, '')) LIKE '%telugutimes%'
   OR lower(coalesce(link_url, '')) LIKE '%telugutimes%';

DELETE FROM public.saved_items WHERE content_item_id IN (SELECT id FROM tt_items);
DELETE FROM public.user_actions WHERE content_item_id IN (SELECT id FROM tt_items);
DELETE FROM public.editorial_reviews WHERE raw_item_id IN (
  SELECT id FROM public.raw_ingestion_items WHERE published_content_item_id IN (SELECT id FROM tt_items)
);
DELETE FROM public.headline_picks WHERE content_id IN (SELECT id FROM tt_items);
DELETE FROM public.content_item_contacts WHERE content_item_id IN (SELECT id FROM tt_items);
DELETE FROM public.content_items WHERE id IN (SELECT id FROM tt_items);

DELETE FROM public.articles
WHERE lower(coalesce(source_name, '')) LIKE '%telugutimes%'
   OR lower(coalesce(source_name, '')) LIKE '%telugu times%'
   OR lower(coalesce(source_url, '')) LIKE '%telugutimes%';

DELETE FROM public.digest_queue
WHERE lower(coalesce(source, '')) LIKE '%telugutimes%'
   OR lower(coalesce(source, '')) LIKE '%telugu times%'
   OR lower(coalesce(source_url, '')) LIKE '%telugutimes%';

DELETE FROM public.raw_ingestion_items
WHERE published_content_item_id IN (SELECT id FROM tt_items)
   OR lower(coalesce(source_name, '')) LIKE '%telugutimes%'
   OR lower(coalesce(canonical_url, '')) LIKE '%telugutimes%'
   OR lower(coalesce(raw_metadata::text, '')) LIKE '%telugutimes%';

DELETE FROM public.content_sources
WHERE lower(coalesce(name, '')) LIKE '%telugu times%'
   OR lower(coalesce(source_url, '')) LIKE '%telugutimes%';