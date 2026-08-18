ALTER TABLE public.collect_runs ADD COLUMN IF NOT EXISTS funnel jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.digest_rejects ADD COLUMN IF NOT EXISTS reason text;