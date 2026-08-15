CREATE TABLE IF NOT EXISTS public.digest_rejects (
  dedupe_key text PRIMARY KEY,
  item_id text,
  title text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT ON public.digest_rejects TO authenticated;
GRANT ALL ON public.digest_rejects TO service_role;
ALTER TABLE public.digest_rejects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can read rejected keys" ON public.digest_rejects;
CREATE POLICY "Staff can read rejected keys" ON public.digest_rejects FOR SELECT TO authenticated USING (is_staff(auth.uid()));

INSERT INTO public.digest_rejects (dedupe_key, item_id, title)
SELECT coalesce(dedupe_key, item_id), item_id, title FROM public.digest_queue WHERE status = 'rejected'
ON CONFLICT (dedupe_key) DO NOTHING;

DELETE FROM public.digest_queue WHERE status = 'rejected';