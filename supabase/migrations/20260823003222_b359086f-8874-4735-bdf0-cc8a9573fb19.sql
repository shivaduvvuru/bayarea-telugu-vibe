CREATE TABLE public.property_videos (
  feature_id text PRIMARY KEY,
  project text NOT NULL,
  developer text,
  video_id text NOT NULL,
  title text,
  note text,
  status text NOT NULL DEFAULT 'pending',
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.property_videos TO anon;
GRANT SELECT ON public.property_videos TO authenticated;
GRANT ALL ON public.property_videos TO service_role;
ALTER TABLE public.property_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read verified property videos" ON public.property_videos FOR SELECT TO anon, authenticated USING (status = 'verified');

CREATE TRIGGER property_videos_touch BEFORE UPDATE ON public.property_videos
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.property_video_clicks (
  id bigserial PRIMARY KEY,
  feature_id text NOT NULL,
  video_id text,
  project text,
  kind text NOT NULL DEFAULT 'thumbnail_click',
  path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.property_video_clicks TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.property_video_clicks_id_seq TO service_role;
ALTER TABLE public.property_video_clicks ENABLE ROW LEVEL SECURITY;

CREATE INDEX property_video_clicks_feature_idx ON public.property_video_clicks (feature_id);