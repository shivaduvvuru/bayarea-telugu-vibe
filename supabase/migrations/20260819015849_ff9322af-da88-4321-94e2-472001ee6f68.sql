CREATE TABLE public.picture_intake (
  item_id text PRIMARY KEY,
  dedupe_key text UNIQUE,
  queue_item_id text,
  stage text NOT NULL DEFAULT 'discovered' CHECK (stage IN ('discovered', 'usable', 'pending', 'approved', 'rejected', 'safety_blocked', 'duplicate')),
  image_url text NOT NULL,
  title text NOT NULL,
  summary text,
  source text,
  source_url text,
  city_slug text,
  industry text,
  star text,
  event text,
  safety_reason text,
  screening_state text NOT NULL DEFAULT 'unprocessed' CHECK (screening_state IN ('unprocessed', 'screening', 'passed', 'blocked', 'unchecked')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.picture_intake TO service_role;

ALTER TABLE public.picture_intake ENABLE ROW LEVEL SECURITY;

CREATE INDEX picture_intake_stage_updated_idx ON public.picture_intake (stage, updated_at DESC, item_id DESC);
CREATE INDEX picture_intake_discovered_idx ON public.picture_intake (discovered_at DESC, item_id DESC);
CREATE INDEX picture_intake_queue_item_idx ON public.picture_intake (queue_item_id) WHERE queue_item_id IS NOT NULL;

CREATE TRIGGER picture_intake_touch
BEFORE UPDATE ON public.picture_intake
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.picture_intake (
  item_id,
  dedupe_key,
  queue_item_id,
  stage,
  image_url,
  title,
  summary,
  source,
  source_url,
  city_slug,
  industry,
  star,
  event,
  screening_state,
  metadata,
  discovered_at,
  reviewed_at,
  created_at,
  updated_at
)
SELECT
  q.item_id,
  q.dedupe_key,
  q.item_id,
  CASE q.status::text
    WHEN 'approved' THEN 'approved'
    WHEN 'rejected' THEN 'rejected'
    ELSE 'pending'
  END,
  q.payload->>'image',
  q.title,
  q.summary,
  q.source,
  q.source_url,
  q.city_slug,
  q.payload->>'industry',
  q.payload->>'star',
  q.payload->>'event',
  CASE WHEN q.payload ? 'solo_verified' THEN 'passed' ELSE 'unchecked' END,
  q.payload,
  q.created_at,
  CASE WHEN q.status::text IN ('approved', 'rejected') THEN q.updated_at ELSE NULL END,
  q.created_at,
  q.updated_at
FROM public.digest_queue q
WHERE q.payload->>'review_type' = 'picture'
  AND nullif(q.payload->>'image', '') IS NOT NULL
ON CONFLICT (item_id) DO NOTHING;