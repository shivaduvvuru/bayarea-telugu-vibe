CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS embedding vector(768);

CREATE INDEX IF NOT EXISTS articles_embedding_ivfflat_idx
  ON public.articles
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE embedding IS NOT NULL;

CREATE OR REPLACE FUNCTION public.match_articles(
  query_embedding vector(768),
  match_threshold double precision,
  match_count integer
)
RETURNS TABLE (
  id uuid,
  title text,
  similarity double precision
)
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  SELECT
    a.id,
    a.title,
    (1 - (a.embedding <=> query_embedding))::double precision AS similarity
  FROM public.articles AS a
  WHERE a.status = 'published'
    AND a.embedding IS NOT NULL
    AND 1 - (a.embedding <=> query_embedding) > match_threshold
    AND a.published_at > now() - interval '48 hours'
  ORDER BY a.embedding <=> query_embedding
  LIMIT LEAST(GREATEST(match_count, 1), 100);
$$;

GRANT EXECUTE ON FUNCTION public.match_articles(vector(768), double precision, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.match_articles(vector(768), double precision, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_articles(vector(768), double precision, integer) TO service_role;