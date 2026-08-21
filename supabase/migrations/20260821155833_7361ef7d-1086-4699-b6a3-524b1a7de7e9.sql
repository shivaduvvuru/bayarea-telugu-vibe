ALTER TABLE public.property_campaigns
  ADD COLUMN IF NOT EXISTS live_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS live_note text;

ALTER TABLE public.property_leads
  ADD COLUMN IF NOT EXISTS contact_status text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS follow_up_note text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.property_live_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_slug text NOT NULL REFERENCES public.property_campaigns(slug) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'photo',
  title text NOT NULL,
  body text,
  media_url text,
  poster_url text,
  developer text,
  booth text,
  status text NOT NULL DEFAULT 'published',
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.property_live_posts TO anon;
GRANT SELECT ON public.property_live_posts TO authenticated;
GRANT ALL ON public.property_live_posts TO service_role;

ALTER TABLE public.property_live_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Published live posts are public" ON public.property_live_posts;
CREATE POLICY "Published live posts are public"
  ON public.property_live_posts FOR SELECT
  USING (status = 'published');

DROP TRIGGER IF EXISTS touch_property_live_posts ON public.property_live_posts;
CREATE TRIGGER touch_property_live_posts
  BEFORE UPDATE ON public.property_live_posts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS property_live_posts_campaign_idx
  ON public.property_live_posts (campaign_slug, created_at DESC);