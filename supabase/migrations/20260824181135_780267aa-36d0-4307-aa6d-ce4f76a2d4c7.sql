CREATE TABLE IF NOT EXISTS public.page_views (
  day date NOT NULL PRIMARY KEY,
  views bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.page_views TO service_role;
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.bump_page_view(_day date DEFAULT (now() AT TIME ZONE 'America/Los_Angeles')::date, _delta integer DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _delta < 1 OR _delta > 100 THEN
    RAISE EXCEPTION 'invalid delta';
  END IF;
  INSERT INTO public.page_views (day, views)
  VALUES (_day, _delta)
  ON CONFLICT (day) DO UPDATE
    SET views = public.page_views.views + _delta,
        updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.bump_page_view(date, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_page_view(date, integer) TO service_role;

SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'collect-gallery-continuous'), schedule => '*/15 * * * *');
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'publish-news-backlog'), schedule => '*/10 * * * *');
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'directory-ingest-hourly'), schedule => '35 */6 * * *');
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'india-ingest-20m'), schedule => '7,37 * * * *');
