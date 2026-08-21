CREATE TABLE public.temple_sources (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  website text,
  city text,
  region text,
  address text,
  latitude numeric,
  longitude numeric,
  deities text[] NOT NULL DEFAULT '{}',
  temple_type text,
  traditions text[] NOT NULL DEFAULT '{}',
  events_url text,
  rss_url text,
  ics_url text,
  gcal_url text,
  facebook_url text,
  instagram_url text,
  status text NOT NULL DEFAULT 'yellow',
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  fail_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  auto_import boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.temple_sources TO anon;
GRANT SELECT ON public.temple_sources TO authenticated;
GRANT ALL ON public.temple_sources TO service_role;
ALTER TABLE public.temple_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active temples" ON public.temple_sources FOR SELECT USING (active);

CREATE TABLE public.temple_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id uuid REFERENCES public.temple_sources(id) ON DELETE SET NULL,
  temple_slug text,
  temple_name text NOT NULL,
  city text,
  region text,
  title text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  deities text[] NOT NULL DEFAULT '{}',
  event_type text NOT NULL DEFAULT 'puja',
  event_group text NOT NULL DEFAULT 'puja',
  level text NOT NULL DEFAULT 'routine',
  image_url text,
  register_url text,
  source_url text,
  source_kind text NOT NULL DEFAULT 'html',
  recurrence text,
  cost_type text,
  language text,
  organizer text,
  status text NOT NULL DEFAULT 'published',
  featured boolean NOT NULL DEFAULT false,
  imported boolean NOT NULL DEFAULT true,
  dedupe_key text NOT NULL UNIQUE,
  external_uid text,
  last_verified_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX temple_events_starts_at_idx ON public.temple_events (starts_at);
CREATE INDEX temple_events_temple_idx ON public.temple_events (temple_slug);
CREATE INDEX temple_events_status_idx ON public.temple_events (status);

GRANT SELECT ON public.temple_events TO anon;
GRANT SELECT ON public.temple_events TO authenticated;
GRANT ALL ON public.temple_events TO service_role;
ALTER TABLE public.temple_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view published temple events" ON public.temple_events FOR SELECT USING (status = 'published');

CREATE TRIGGER temple_sources_touch BEFORE UPDATE ON public.temple_sources FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER temple_events_touch BEFORE UPDATE ON public.temple_events FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();