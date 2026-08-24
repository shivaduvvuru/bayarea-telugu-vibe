CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.rejected_duplicates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind text NOT NULL DEFAULT 'article',
  reason text NOT NULL,
  score numeric,
  title text,
  link_url text,
  dedupe_key text,
  original_id uuid,
  original_url text,
  source text,
  entry_point text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.rejected_duplicates TO service_role;
ALTER TABLE public.rejected_duplicates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read rejected duplicates"
  ON public.rejected_duplicates FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE INDEX IF NOT EXISTS rejected_duplicates_created_idx
  ON public.rejected_duplicates (created_at DESC);
CREATE INDEX IF NOT EXISTS rejected_duplicates_original_idx
  ON public.rejected_duplicates (original_id);

CREATE TABLE IF NOT EXISTS public.image_fingerprints (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_hash text,
  perceptual_hash text,
  image_url text NOT NULL,
  bytes integer,
  content_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.image_fingerprints TO service_role;
ALTER TABLE public.image_fingerprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read image fingerprints"
  ON public.image_fingerprints FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE UNIQUE INDEX IF NOT EXISTS image_fingerprints_file_hash_idx
  ON public.image_fingerprints (file_hash) WHERE file_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS image_fingerprints_phash_idx
  ON public.image_fingerprints (perceptual_hash) WHERE perceptual_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS image_fingerprints_url_idx
  ON public.image_fingerprints (image_url);

CREATE TRIGGER image_fingerprints_touch BEFORE UPDATE ON public.image_fingerprints
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS content_items_title_trgm_idx
  ON public.content_items USING gin (title gin_trgm_ops);

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
SET search_path = public
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
      SELECT ci.id, similarity(ci.body, _body)::numeric, 'body'::text
      FROM public.content_items ci
      WHERE ci.status <> 'duplicate'
        AND ci.body IS NOT NULL
        AND length(ci.body) >= 200
        AND ci.created_at > now() - interval '30 days'
        AND similarity(ci.body, _body) >= _threshold
      ORDER BY similarity(ci.body, _body) DESC
      LIMIT 1;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.find_article_duplicate(text, text, text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_article_duplicate(text, text, text, numeric) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_article_duplicate(text, text, text, numeric) TO service_role;

SELECT cron.unschedule('daily-dedupe-sweep')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-dedupe-sweep');

SELECT cron.schedule(
  'daily-dedupe-sweep',
  '20 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--21d2eeed-01e3-4e0e-a028-88e01859acea.lovable.app/api/public/hooks/dedupe-sweep',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.hook_token('ingest')
    ),
    body := '{"trigger":"cron"}'::jsonb
  );
  $$
);