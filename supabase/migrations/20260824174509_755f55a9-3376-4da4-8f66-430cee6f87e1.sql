CREATE OR REPLACE FUNCTION public.article_key_tokens(_title text)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  -- Proper nouns and numbers carry the identity of a story: "Irumudi", "72",
  -- "Crore". Leading word is dropped because every headline starts capitalised.
  SELECT coalesce(array_agg(DISTINCT t), '{}'::text[])
  FROM (
    SELECT lower(m[1]) AS t
    FROM regexp_matches(coalesce(_title, ''), '([A-Z][A-Za-z]{2,}|[0-9]+)', 'g') AS m
    OFFSET 1
  ) s
  WHERE t NOT IN ('the','and','for','with','from','after','over','into','says','new','this','that');
$function$;

DROP FUNCTION IF EXISTS public.find_article_duplicate(text, text, text, numeric);
CREATE OR REPLACE FUNCTION public.find_article_duplicate(_title text, _link text DEFAULT NULL::text, _body text DEFAULT NULL::text, _threshold numeric DEFAULT 0.85, _loose numeric DEFAULT 0.55)
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

  -- Exact-ish headline (>= _threshold, default 0.85): blocking, 7-day window.
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

  -- Same story, different publisher. Two independent signals inside 72 hours:
  -- loose trigram similarity (>= _loose, default 0.55) and >= 3 shared proper
  -- nouns / numbers. Reported as 'title-weak' / 'tokens' so the caller can log
  -- them without discarding while the thresholds are being tuned.
  IF _norm <> '' AND length(_norm) >= 20 THEN
    RETURN QUERY
      WITH recent AS (
        SELECT ci.id, ci.title, ci.created_at
        FROM public.content_items ci
        WHERE ci.status <> 'duplicate'
          AND ci.title IS NOT NULL
          AND ci.created_at > now() - interval '72 hours'
      ), scored AS (
        SELECT r.id,
               extensions.similarity(r.title, _title)::numeric AS sim,
               cardinality(
                 ARRAY(
                   SELECT unnest(public.article_key_tokens(r.title))
                   INTERSECT
                   SELECT unnest(public.article_key_tokens(_title))
                 )
               ) AS shared,
               r.created_at
        FROM recent r
      )
      SELECT s.id,
             s.sim,
             CASE WHEN s.sim >= _loose THEN 'title-weak' ELSE 'tokens' END
      FROM scored s
      WHERE s.sim >= _loose OR s.shared >= 3
      ORDER BY s.sim DESC, s.shared DESC, s.created_at ASC
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

REVOKE ALL ON FUNCTION public.find_article_duplicate(text, text, text, numeric, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_article_duplicate(text, text, text, numeric, numeric) TO service_role;
REVOKE ALL ON FUNCTION public.article_key_tokens(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.article_key_tokens(text) TO service_role;