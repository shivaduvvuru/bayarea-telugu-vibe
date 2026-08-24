CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO service_role;

CREATE OR REPLACE FUNCTION public.find_article_duplicate(
  _title text,
  _link text DEFAULT NULL,
  _body text DEFAULT NULL,
  _threshold numeric DEFAULT 0.85
)
RETURNS TABLE (id uuid, score numeric, reason text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.find_article_duplicate(text, text, text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_article_duplicate(text, text, text, numeric) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_article_duplicate(text, text, text, numeric) TO service_role;