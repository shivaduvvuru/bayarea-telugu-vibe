CREATE TABLE public.directory_entities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type text NOT NULL DEFAULT 'business',
  category text NOT NULL,
  subcategory text,
  extra_categories text[] NOT NULL DEFAULT '{}',
  community_tags text[] NOT NULL DEFAULT '{}',
  service_tags text[] NOT NULL DEFAULT '{}',
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  address text,
  city text,
  county text,
  state text NOT NULL DEFAULT 'CA',
  zip text,
  latitude numeric,
  longitude numeric,
  phone text,
  email text,
  website text,
  hours text,
  accessibility text,
  image text,
  price_level integer,
  deity text,
  events_url text,
  verified_status boolean NOT NULL DEFAULT false,
  featured_status boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'published',
  needs_review boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'osm',
  source_id text,
  attribution text,
  osm_id text,
  foursquare_id text,
  yelp_id text,
  google_place_id text,
  external_url text,
  tba_rating numeric,
  tba_review_count integer NOT NULL DEFAULT 0,
  dedupe_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_verified_at timestamptz,
  last_synced_at timestamptz
);

CREATE UNIQUE INDEX directory_entities_osm_id_key ON public.directory_entities (osm_id) WHERE osm_id IS NOT NULL;
CREATE INDEX directory_entities_category_city_idx ON public.directory_entities (category, city);
CREATE INDEX directory_entities_dedupe_idx ON public.directory_entities (dedupe_key);
CREATE INDEX directory_entities_sync_idx ON public.directory_entities (last_synced_at);

GRANT SELECT ON public.directory_entities TO anon;
GRANT SELECT ON public.directory_entities TO authenticated;
GRANT ALL ON public.directory_entities TO service_role;

ALTER TABLE public.directory_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published listings are public" ON public.directory_entities
  FOR SELECT USING (status = 'published');

CREATE POLICY "Staff read every listing" ON public.directory_entities
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE TRIGGER directory_entities_touch
  BEFORE UPDATE ON public.directory_entities
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();