CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

CREATE TABLE public.property_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  headline text NOT NULL,
  subheading text,
  promo_title text,
  promo_line text,
  venue text,
  city text,
  organizer text,
  event_start date,
  event_end date,
  event_month_label text,
  opening_hours text,
  official_url text,
  map_url text,
  participation_note text,
  hero_image_url text,
  active boolean NOT NULL DEFAULT true,
  homepage_visible boolean NOT NULL DEFAULT true,
  post_event boolean NOT NULL DEFAULT false,
  campaign_start timestamptz,
  campaign_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_slug text NOT NULL REFERENCES public.property_campaigns(slug) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  project_name text NOT NULL,
  developer text NOT NULL,
  developer_logo_url text,
  locality text,
  zone text,
  property_type text,
  price_from_lakh numeric,
  price_note text,
  configuration text,
  project_status text,
  rera_number text,
  image_url text,
  gallery_urls text[] NOT NULL DEFAULT '{}',
  description text,
  amenities text[] NOT NULL DEFAULT '{}',
  is_tt_advertiser boolean NOT NULL DEFAULT false,
  is_credai_participant boolean NOT NULL DEFAULT false,
  website_url text,
  enquiry_url text,
  contact_phone text,
  source_url text,
  source_name text,
  priority integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX properties_campaign_idx ON public.properties (campaign_slug, status);

CREATE TABLE public.property_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_slug text NOT NULL,
  campaign_code text NOT NULL DEFAULT 'CREDAI_2026',
  property_ids uuid[] NOT NULL DEFAULT '{}',
  project_names text[] NOT NULL DEFAULT '{}',
  developers text[] NOT NULL DEFAULT '{}',
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  country text,
  city text,
  preferred_contact text,
  budget text,
  message text,
  source_page text,
  referrer text,
  utm jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.property_metrics (
  id bigserial PRIMARY KEY,
  campaign_slug text NOT NULL,
  kind text NOT NULL,
  property_id uuid,
  project_name text,
  developer text,
  country text,
  path text,
  referrer text,
  utm_source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX property_metrics_campaign_idx ON public.property_metrics (campaign_slug, kind, created_at DESC);

GRANT SELECT ON public.property_campaigns TO anon, authenticated;
GRANT SELECT ON public.properties TO anon, authenticated;
GRANT ALL ON public.property_campaigns TO service_role;
GRANT ALL ON public.properties TO service_role;
GRANT ALL ON public.property_leads TO service_role;
GRANT ALL ON public.property_metrics TO service_role;
GRANT ALL ON SEQUENCE public.property_metrics_id_seq TO service_role;

ALTER TABLE public.property_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active campaigns"
  ON public.property_campaigns FOR SELECT TO anon, authenticated USING (active);
CREATE POLICY "Anyone can view published properties"
  ON public.properties FOR SELECT TO anon, authenticated USING (status = 'published');

CREATE TRIGGER property_campaigns_updated_at BEFORE UPDATE ON public.property_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER properties_updated_at BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.property_campaigns
  (slug, name, headline, subheading, promo_title, promo_line, venue, city, organizer,
   event_start, event_end, event_month_label, official_url, map_url, participation_note,
   campaign_start, campaign_end)
VALUES (
  'credai-hyderabad-2026',
  'CREDAI Property Show 2026 — Hyderabad',
  'Hyderabad Property Opportunities — All in One Place',
  'Explore projects from developers featured in Telugu Times and participating in Hyderabad''s CREDAI Property Show 2026.',
  'CREDAI Property Show 2026',
  'Hyderabad''s leading developers under one roof',
  'HITEX Exhibition Centre, Madhapur',
  'Hyderabad',
  'CREDAI Hyderabad',
  '2026-08-28', '2026-08-30', 'August 2026',
  'https://www.telugutimes.net/topic/credai-property-expo-2026',
  'https://maps.google.com/?q=HITEX+Exhibition+Centre+Madhapur+Hyderabad',
  'Telugu Times is participating as a media and promotional partner, supporting visibility of the Property Show among the U.S. Telugu and Indian community.',
  now(), '2026-09-30T23:59:00Z'
);

INSERT INTO public.properties
  (campaign_slug, slug, project_name, developer, locality, zone, property_type, price_from_lakh,
   price_note, configuration, project_status, image_url, description, amenities,
   is_tt_advertiser, priority, source_url, source_name)
VALUES
 ('credai-hyderabad-2026', 'ghr-callisto', 'GHR Callisto', 'GHR Infra', 'Kollur', 'West Hyderabad',
  'Apartments', 83,
  'Starting price published by the developer with its 2BHK Freedom Offer; confirm current pricing with the developer.',
  '2, 2.5, 3 & 4 BHK', 'Under Construction',
  'https://www.telugutimes.net/wp-content/uploads/2026/08/ghrinfra.jpg',
  'An IGBC Green Homes pre-certified Gold rated community of about 1,190 homes on 8.3 acres in Kollur, roughly 10 minutes from Neopolis, with nearly 70% open space. Phase 1 handover has begun.',
  ARRAY['IGBC Green Homes pre-certified Gold','~70% open space','8.3 acre community','EV parking option'],
  true, 100,
  'https://www.telugutimes.net/realestate/ghr-infra-launches-2bhk-freedom-offer-at-ghr-callisto-403158.html',
  'Telugu Times'),
 ('credai-hyderabad-2026', 'csr-estates-ashwaththa', 'Ashwaththa', 'CSR Estates', 'Hyderabad', 'Hyderabad',
  'Apartments', NULL,
  'Pricing not published by the developer.',
  '3 & 4 BHK', 'Under Construction',
  'https://www.telugutimes.net/wp-content/uploads/2026/03/csr.jpg',
  'CSR Estates'' debut residential project: 426 apartments across 34 floors on 2.74 acres, with a 34,800 sq ft eight-level clubhouse designed for every age group.',
  ARRAY['8-level, 34,800 sq ft clubhouse','Cricket net & multipurpose court','Creche, yoga and Zumba studios','Library, theatre and guest rooms','Pickleball and open lawn'],
  true, 90,
  'https://www.telugutimes.net/realestate/csr-estates-newest-project-is-ashwaththa-346941.html',
  'Telugu Times');