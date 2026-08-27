ALTER TABLE public.url_resolutions ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.digest_queue ADD COLUMN IF NOT EXISTS image_source text;
GRANT ALL ON public.url_resolutions TO service_role;
GRANT ALL ON public.digest_queue TO service_role;
GRANT SELECT ON public.digest_queue TO authenticated;