DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_status') THEN
    CREATE TYPE public.review_status AS ENUM ('pending','approved','rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'upload_state') THEN
    CREATE TYPE public.upload_state AS ENUM ('none','queued','sent','failed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.digest_queue (
  item_id text PRIMARY KEY,
  dedupe_key text UNIQUE,
  digest_date date NOT NULL,
  kind text NOT NULL DEFAULT 'news',
  city_slug text NOT NULL,
  title text NOT NULL,
  summary text,
  source text,
  source_url text,
  published_at timestamptz,
  origin text NOT NULL DEFAULT 'feed',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.review_status NOT NULL DEFAULT 'pending',
  upload_status public.upload_state NOT NULL DEFAULT 'none',
  uploaded_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.digest_queue TO authenticated;
GRANT ALL ON public.digest_queue TO service_role;

ALTER TABLE public.digest_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage the digest queue" ON public.digest_queue;
CREATE POLICY "Staff manage the digest queue"
ON public.digest_queue FOR ALL TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS digest_queue_date_idx ON public.digest_queue (digest_date DESC);

DROP TRIGGER IF EXISTS digest_queue_touch ON public.digest_queue;
CREATE TRIGGER digest_queue_touch BEFORE UPDATE ON public.digest_queue
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();