-- Enums
CREATE TYPE public.source_class AS ENUM ('authority','reporter','community','organizer','internal','submission');
CREATE TYPE public.connector_type AS ENUM ('direct_rss','direct_api','goodbarber','manual','webhook','future_connector');
CREATE TYPE public.source_status AS ENUM ('healthy','error','inactive');
CREATE TYPE public.source_confidence AS ENUM ('high','medium','low');
CREATE TYPE public.ingest_status AS ENUM ('new','enriched','recommended','needs_review','approved','published','rejected','duplicate');
CREATE TYPE public.dedupe_status AS ENUM ('unique','possible_duplicate','duplicate','merged');
CREATE TYPE public.content_label AS ENUM ('official_source','aggregated','original','community_submission','sponsored');

-- Cities
CREATE TABLE public.cities (
  slug text PRIMARY KEY,
  name text NOT NULL,
  region text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cities TO anon, authenticated;
GRANT ALL ON public.cities TO service_role;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cities are public" ON public.cities FOR SELECT TO anon, authenticated USING (true);

-- Topics
CREATE TABLE public.topics (
  slug text PRIMARY KEY,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.topics TO anon, authenticated;
GRANT ALL ON public.topics TO service_role;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Topics are public" ON public.topics FOR SELECT TO anon, authenticated USING (true);

-- Source registry
CREATE TABLE public.content_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source_url text,
  rss_url text,
  api_url text,
  source_class public.source_class NOT NULL DEFAULT 'community',
  connector_type public.connector_type NOT NULL DEFAULT 'direct_rss',
  confidence public.source_confidence NOT NULL DEFAULT 'medium',
  cities text[] NOT NULL DEFAULT '{}',
  topics text[] NOT NULL DEFAULT '{}',
  frequency_minutes integer NOT NULL DEFAULT 180,
  status public.source_status NOT NULL DEFAULT 'healthy',
  active boolean NOT NULL DEFAULT true,
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  items_discovered integer NOT NULL DEFAULT 0,
  items_published integer NOT NULL DEFAULT 0,
  duplicates_removed integer NOT NULL DEFAULT 0,
  read_original_clicks integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX content_sources_name_key ON public.content_sources (lower(name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_sources TO authenticated;
GRANT ALL ON public.content_sources TO service_role;
ALTER TABLE public.content_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage sources" ON public.content_sources FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER content_sources_touch BEFORE UPDATE ON public.content_sources
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Story clusters
CREATE TABLE public.story_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text NOT NULL,
  headline text NOT NULL,
  city text,
  topic text,
  story_topic_id text,
  source_names text[] NOT NULL DEFAULT '{}',
  item_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX story_clusters_dedupe_key ON public.story_clusters (dedupe_key);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_clusters TO authenticated;
GRANT SELECT ON public.story_clusters TO anon;
GRANT ALL ON public.story_clusters TO service_role;
ALTER TABLE public.story_clusters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clusters are public" ON public.story_clusters FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Staff manage clusters" ON public.story_clusters FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER story_clusters_touch BEFORE UPDATE ON public.story_clusters
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Raw ingestion inbox
CREATE TABLE public.raw_ingestion_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.content_sources(id) ON DELETE SET NULL,
  source_name text NOT NULL,
  connector_type public.connector_type NOT NULL DEFAULT 'direct_rss',
  external_item_id text,
  original_title text NOT NULL,
  canonical_url text NOT NULL,
  excerpt text,
  image_url text,
  author text,
  publication_datetime timestamptz,
  discovered_datetime timestamptz NOT NULL DEFAULT now(),
  city text,
  topic text,
  dedupe_key text,
  dedupe_status public.dedupe_status NOT NULL DEFAULT 'unique',
  duplicate_of uuid REFERENCES public.raw_ingestion_items(id) ON DELETE SET NULL,
  story_cluster_id uuid REFERENCES public.story_clusters(id) ON DELETE SET NULL,
  processing_status public.ingest_status NOT NULL DEFAULT 'new',
  digest_headline text,
  what_happened text,
  why_it_matters text,
  what_to_do text,
  urgency text,
  deadline_at timestamptz,
  event_start timestamptz,
  priority_score numeric NOT NULL DEFAULT 0,
  community_relevance numeric NOT NULL DEFAULT 0,
  requires_human_review boolean NOT NULL DEFAULT true,
  tags text[] NOT NULL DEFAULT '{}',
  ai_generated_at timestamptz,
  raw_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_content_item_id uuid REFERENCES public.content_items(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX raw_items_canonical_url_key ON public.raw_ingestion_items (canonical_url);
CREATE INDEX raw_items_status_idx ON public.raw_ingestion_items (processing_status, discovered_datetime DESC);
CREATE INDEX raw_items_dedupe_idx ON public.raw_ingestion_items (dedupe_key);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.raw_ingestion_items TO authenticated;
GRANT ALL ON public.raw_ingestion_items TO service_role;
ALTER TABLE public.raw_ingestion_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage raw items" ON public.raw_ingestion_items FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER raw_items_touch BEFORE UPDATE ON public.raw_ingestion_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Editorial review log
CREATE TABLE public.editorial_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_item_id uuid REFERENCES public.raw_ingestion_items(id) ON DELETE CASCADE,
  action text NOT NULL,
  rejection_reason text,
  editor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX editorial_reviews_item_idx ON public.editorial_reviews (raw_item_id, created_at DESC);
GRANT SELECT, INSERT ON public.editorial_reviews TO authenticated;
GRANT ALL ON public.editorial_reviews TO service_role;
ALTER TABLE public.editorial_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read reviews" ON public.editorial_reviews FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff log reviews" ON public.editorial_reviews FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

-- Reader preferences
CREATE TABLE public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  home_city text,
  interests text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own preferences" ON public.user_preferences FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER user_preferences_touch BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Saved items
CREATE TABLE public.saved_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_item_id uuid REFERENCES public.content_items(id) ON DELETE CASCADE,
  external_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX saved_items_user_idx ON public.saved_items (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_items TO authenticated;
GRANT ALL ON public.saved_items TO service_role;
ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own saved items" ON public.saved_items FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Reader actions
CREATE TABLE public.user_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  content_item_id uuid REFERENCES public.content_items(id) ON DELETE SET NULL,
  source_id uuid REFERENCES public.content_sources(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_actions_created_idx ON public.user_actions (created_at DESC);
GRANT SELECT, INSERT ON public.user_actions TO authenticated;
GRANT ALL ON public.user_actions TO service_role;
ALTER TABLE public.user_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own actions readable" ON public.user_actions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE POLICY "Own actions writable" ON public.user_actions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Published content gains digest fields
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES public.content_sources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS story_cluster_id uuid REFERENCES public.story_clusters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS content_label public.content_label,
  ADD COLUMN IF NOT EXISTS confidence public.source_confidence,
  ADD COLUMN IF NOT EXISTS priority_score numeric,
  ADD COLUMN IF NOT EXISTS why_it_matters text,
  ADD COLUMN IF NOT EXISTS what_to_do text,
  ADD COLUMN IF NOT EXISTS source_names text[],
  ADD COLUMN IF NOT EXISTS ai_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS corrected_at timestamptz,
  ADD COLUMN IF NOT EXISTS correction_note text;

-- Seed cities
INSERT INTO public.cities (slug, name, region, sort_order) VALUES
  ('fremont','Fremont','East Bay',10),
  ('milpitas','Milpitas','South Bay',20),
  ('san-jose','San Jose','South Bay',30),
  ('cupertino','Cupertino','South Bay',40),
  ('sunnyvale','Sunnyvale','South Bay',50)
ON CONFLICT (slug) DO NOTHING;

-- Seed topics
INSERT INTO public.topics (slug, name, sort_order) VALUES
  ('community','Local Community',10),
  ('events','Events',20),
  ('schools','Kids & Schools',30),
  ('transportation','Transportation',40),
  ('government','Local Government',50),
  ('real-estate','Real Estate & Development',60),
  ('jobs-tech','Jobs & Technology',70),
  ('immigration','Immigration',80),
  ('tax-money','Tax & Money',90),
  ('family','Family Activities',100),
  ('temples','Temples',110),
  ('restaurants','Restaurants',120),
  ('travel','Travel',130),
  ('public-safety','Public Safety',140),
  ('business','Business',150)
ON CONFLICT (slug) DO NOTHING;

-- Seed starter sources
INSERT INTO public.content_sources (name, source_url, rss_url, source_class, connector_type, confidence, cities, topics, frequency_minutes) VALUES
  ('City of Fremont','https://www.fremont.gov','https://www.fremont.gov/RSSFeed.aspx?ModID=76&CID=All','authority','direct_rss','high','{fremont}','{government,community}',180),
  ('City of Milpitas','https://www.milpitas.gov','https://www.milpitas.gov/RSSFeed.aspx?ModID=76&CID=All','authority','direct_rss','high','{milpitas}','{government,community}',180),
  ('City of San Jose','https://www.sanjoseca.gov','https://www.sanjoseca.gov/Home/Components/RssFeeds/RssFeed/Get?rssFeedId=1','authority','direct_rss','high','{san-jose}','{government,community}',180),
  ('City of Cupertino','https://www.cupertino.gov','https://www.cupertino.gov/RSSFeed.aspx?ModID=76&CID=All','authority','direct_rss','high','{cupertino}','{government,community}',180),
  ('City of Sunnyvale','https://www.sunnyvale.ca.gov','https://www.sunnyvale.ca.gov/RSSFeed.aspx?ModID=76&CID=All','authority','direct_rss','high','{sunnyvale}','{government,community}',180),
  ('Santa Clara County','https://news.santaclaracounty.gov','https://news.santaclaracounty.gov/rss.xml','authority','direct_rss','high','{san-jose,cupertino,sunnyvale,milpitas}','{government,public-safety}',240),
  ('Alameda County','https://www.acgov.org','https://www.acgov.org/rss/news.xml','authority','direct_rss','high','{fremont}','{government,public-safety}',240),
  ('BART','https://www.bart.gov','https://www.bart.gov/news/rss.xml','authority','direct_rss','high','{fremont,milpitas,san-jose}','{transportation}',60),
  ('VTA','https://www.vta.org','https://www.vta.org/rss/news','authority','direct_rss','high','{san-jose,milpitas,sunnyvale,cupertino}','{transportation}',60),
  ('Caltrain','https://www.caltrain.com','https://www.caltrain.com/rss/news','authority','direct_rss','high','{san-jose,sunnyvale}','{transportation}',60),
  ('Fremont Unified School District','https://www.fremontunified.org',NULL,'authority','manual','high','{fremont}','{schools,family}',360),
  ('Milpitas Unified School District','https://www.musd.org',NULL,'authority','manual','high','{milpitas}','{schools,family}',360),
  ('San Jose Unified School District','https://www.sjusd.org',NULL,'authority','manual','high','{san-jose}','{schools,family}',360),
  ('Cupertino Union School District','https://www.cusdk8.org',NULL,'authority','manual','high','{cupertino}','{schools,family}',360),
  ('Fremont Union High School District','https://www.fuhsd.org',NULL,'authority','manual','high','{cupertino,sunnyvale}','{schools,family}',360),
  ('Sunnyvale School District','https://www.sesd.org',NULL,'authority','manual','high','{sunnyvale}','{schools,family}',360),
  ('Santa Clara Valley Water','https://www.valleywater.org','https://www.valleywater.org/rss','authority','direct_rss','high','{san-jose,milpitas}','{government,public-safety}',360),
  ('Fremont Police Department','https://www.fremontpolice.gov',NULL,'authority','manual','high','{fremont}','{public-safety}',240),
  ('San Jose Police Department','https://www.sjpd.org',NULL,'authority','manual','high','{san-jose}','{public-safety}',240),
  ('Mercury News','https://www.mercurynews.com','https://www.mercurynews.com/feed/','reporter','direct_rss','high','{san-jose,fremont,milpitas,cupertino,sunnyvale}','{community,business,real-estate}',60),
  ('SFGate Bay Area','https://www.sfgate.com','https://www.sfgate.com/bayarea/feed/','reporter','direct_rss','high','{san-jose,fremont}','{community,business}',60),
  ('San Jose Spotlight','https://sanjosespotlight.com','https://sanjosespotlight.com/feed/','reporter','direct_rss','high','{san-jose}','{government,community,real-estate}',120),
  ('Patch Fremont','https://patch.com/california/fremont','https://patch.com/california/fremont/rss','reporter','direct_rss','medium','{fremont}','{community,events,public-safety}',120),
  ('Patch Milpitas','https://patch.com/california/milpitas','https://patch.com/california/milpitas/rss','reporter','direct_rss','medium','{milpitas}','{community,events,public-safety}',120),
  ('Patch San Jose','https://patch.com/california/sanjose','https://patch.com/california/sanjose/rss','reporter','direct_rss','medium','{san-jose}','{community,events,public-safety}',120),
  ('Patch Cupertino','https://patch.com/california/cupertino','https://patch.com/california/cupertino/rss','reporter','direct_rss','medium','{cupertino}','{community,events,public-safety}',120),
  ('Patch Sunnyvale','https://patch.com/california/sunnyvale','https://patch.com/california/sunnyvale/rss','reporter','direct_rss','medium','{sunnyvale}','{community,events,public-safety}',120),
  ('Palo Alto Online','https://www.paloaltoonline.com','https://www.paloaltoonline.com/rss/','reporter','direct_rss','medium','{sunnyvale,cupertino}','{community,schools}',180),
  ('KQED Bay Area','https://www.kqed.org','https://ww2.kqed.org/news/feed/','reporter','direct_rss','high','{san-jose,fremont}','{community,immigration,government}',180),
  ('Bay Area Telugu Association','https://www.bata.org',NULL,'community','manual','medium','{fremont,milpitas,san-jose,cupertino,sunnyvale}','{community,events}',360),
  ('Silicon Andhra','https://siliconandhra.org',NULL,'community','manual','medium','{milpitas,san-jose}','{community,events}',360),
  ('Shiva Vishnu Temple Livermore','https://www.livermoretemple.org',NULL,'community','manual','medium','{fremont}','{temples,events}',360),
  ('Sunnyvale Hindu Temple','https://www.svhindutemple.org',NULL,'community','manual','medium','{sunnyvale}','{temples,events}',360),
  ('Fremont Chamber of Commerce','https://www.fremontbusiness.com',NULL,'organizer','manual','medium','{fremont}','{business,events}',360),
  ('Eventbrite Bay Area','https://www.eventbrite.com',NULL,'organizer','manual','medium','{fremont,milpitas,san-jose,cupertino,sunnyvale}','{events,family}',180),
  ('Telugu Times','https://www.telugutimes.net','https://www.telugutimes.net/feed/','internal','direct_rss','high','{fremont,milpitas,san-jose,cupertino,sunnyvale}','{community,events}',120),
  ('Times Bay Area newsroom',NULL,NULL,'internal','manual','high','{fremont,milpitas,san-jose,cupertino,sunnyvale}','{community}',1440),
  ('Community submissions',NULL,NULL,'submission','manual','low','{fremont,milpitas,san-jose,cupertino,sunnyvale}','{community,events}',1440)
ON CONFLICT DO NOTHING;