CREATE OR REPLACE FUNCTION public.find_article_duplicate(_title text, _link text DEFAULT NULL::text, _body text DEFAULT NULL::text, _threshold numeric DEFAULT 0.85)
 RETURNS TABLE(id uuid, score numeric, reason text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _norm text;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  _norm := btrim(regexp_replace(lower(coalesce(_title, '')), '[^a-z0-9]+', ' ', 'g'));

  IF _norm <> '' THEN
    RETURN QUERY
      SELECT ci.id, 1.0::numeric, 'title'::text
      FROM public.content_items ci
      WHERE ci.status <> 'duplicate'
        AND btrim(regexp_replace(lower(coalesce(ci.title, '')), '[^a-z0-9]+', ' ', 'g')) = _norm
      ORDER BY ci.created_at ASC
      LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  IF coalesce(_link, '') <> '' THEN
    RETURN QUERY
      SELECT ci.id, 1.0::numeric, 'url'::text
      FROM public.content_items ci
      WHERE ci.status <> 'duplicate'
        AND (ci.link_url = _link OR ci.source_ref = _link)
      ORDER BY ci.created_at ASC
      LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Near-duplicate headline: same story re-worded by another publisher.
  -- Unscoped by city/category/source; 7-day window so genuine anniversaries
  -- and recurring events are not blocked.
  IF _norm <> '' AND length(_norm) >= 20 THEN
    RETURN QUERY
      SELECT ci.id, extensions.similarity(ci.title, _title)::numeric, 'title'::text
      FROM public.content_items ci
      WHERE ci.status <> 'duplicate'
        AND ci.title IS NOT NULL
        AND ci.created_at > now() - interval '7 days'
        AND extensions.similarity(ci.title, _title) >= _threshold
      ORDER BY extensions.similarity(ci.title, _title) DESC
      LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  IF _body IS NOT NULL AND length(_body) >= 200 THEN
    RETURN QUERY
      SELECT ci.id, extensions.similarity(ci.body, _body)::numeric, 'body'::text
      FROM public.content_items ci
      WHERE ci.status <> 'duplicate'
        AND ci.body IS NOT NULL
        AND length(ci.body) >= 200
        AND ci.created_at > now() - interval '30 days'
        AND extensions.similarity(ci.body, _body) >= _threshold
      ORDER BY extensions.similarity(ci.body, _body) DESC
      LIMIT 1;
  END IF;
END;
$function$;