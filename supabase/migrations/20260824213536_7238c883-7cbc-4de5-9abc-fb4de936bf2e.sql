-- Canonical link: scheme/www/query/fragment/amp/trailing slash removed; TOI reduced to its article id.
CREATE OR REPLACE FUNCTION public.canonical_link(_url text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN u IS NULL OR u = '' THEN NULL
    WHEN u ~ 'timesofindia\.indiatimes\.com' AND u ~ 'articleshow/[0-9]+'
      THEN 'timesofindia.indiatimes.com/articleshow/'
           || (regexp_match(u, 'articleshow/([0-9]+)'))[1] || '.cms'
    ELSE u
  END
  FROM (
    SELECT nullif(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(lower(btrim(coalesce(_url, ''))), '^https?://', ''),
              '^www\.', ''),
            '[?#].*$', ''),
          '/amp/?$', ''),
        '/+$', ''),
      '') AS u
  ) s;
$$;

-- Canonical image: query string, size/resize segments and -WxH suffixes removed.
CREATE OR REPLACE FUNCTION public.canonical_image(_url text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN u IS NULL OR u = '' THEN NULL
    WHEN u ~ 'msid-[0-9]+' THEN 'msid-' || (regexp_match(u, 'msid-([0-9]+)'))[1]
    ELSE regexp_replace(
           regexp_replace(u, '[-_][0-9]{2,4}x[0-9]{2,4}(?=\.[a-z]{3,4}$)', ''),
           '(width|height|resizemode|imgsize|quality|size)-[0-9a-z]+,?', '', 'g')
  END
  FROM (
    SELECT nullif(
      regexp_replace(
        regexp_replace(lower(btrim(coalesce(_url, ''))), '^https?://', ''),
        '[?#].*$', ''),
      '') AS u
  ) s;
$$;

-- Strict headline normalisation: NFKC, curly quotes/dashes/ellipsis and all punctuation dropped.
CREATE OR REPLACE FUNCTION public.norm_title_strict(_title text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT nullif(
    btrim(
      regexp_replace(
        regexp_replace(
          lower(normalize(coalesce(_title, ''), NFKC)),
          '[^a-z0-9\u0C00-\u0C7F]+', ' ', 'g'),
        '\s+', ' ', 'g')
    ),
  '');
$$;

ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS canonical_url text
    GENERATED ALWAYS AS (public.canonical_link(coalesce(link_url, source_ref))) STORED,
  ADD COLUMN IF NOT EXISTS canonical_image text
    GENERATED ALWAYS AS (public.canonical_image(image_url)) STORED,
  ADD COLUMN IF NOT EXISTS norm_title text
    GENERATED ALWAYS AS (public.norm_title_strict(title)) STORED;

CREATE INDEX IF NOT EXISTS content_items_canonical_url_idx
  ON public.content_items (canonical_url) WHERE canonical_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS content_items_canonical_image_idx
  ON public.content_items (canonical_image) WHERE canonical_image IS NOT NULL;
CREATE INDEX IF NOT EXISTS content_items_norm_title_idx
  ON public.content_items (norm_title, created_at DESC) WHERE norm_title IS NOT NULL;
