CREATE TABLE IF NOT EXISTS public.photo_likes (
  slug text PRIMARY KEY,
  likes integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.photo_likes TO anon;
GRANT SELECT ON public.photo_likes TO authenticated;
GRANT ALL ON public.photo_likes TO service_role;

ALTER TABLE public.photo_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "photo likes are public" ON public.photo_likes;
CREATE POLICY "photo likes are public" ON public.photo_likes FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.bump_photo_like(_slug text, _delta integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _total integer;
BEGIN
  IF _slug IS NULL OR length(_slug) < 2 OR length(_slug) > 200 THEN
    RAISE EXCEPTION 'invalid slug';
  END IF;
  IF _delta NOT IN (-1, 1) THEN
    RAISE EXCEPTION 'invalid delta';
  END IF;
  INSERT INTO public.photo_likes (slug, likes)
  VALUES (_slug, greatest(_delta, 0))
  ON CONFLICT (slug) DO UPDATE
    SET likes = greatest(public.photo_likes.likes + _delta, 0),
        updated_at = now()
  RETURNING likes INTO _total;
  RETURN _total;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_photo_like(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_photo_like(text, integer) TO anon, authenticated, service_role;

-- Gallery folder capacity rotation: overflow goes to the archive, and archived
-- pictures come back after 15 days, most-liked first.
CREATE INDEX IF NOT EXISTS content_items_gallery_idx
  ON public.content_items (category, status, published_at DESC);