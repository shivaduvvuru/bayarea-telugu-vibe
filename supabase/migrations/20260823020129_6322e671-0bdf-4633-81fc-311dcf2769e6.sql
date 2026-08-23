ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS osm_id text,
  ADD COLUMN IF NOT EXISTS foursquare_id text,
  ADD COLUMN IF NOT EXISTS yelp_id text,
  ADD COLUMN IF NOT EXISTS google_place_id text,
  ADD COLUMN IF NOT EXISTS zip text,
  ADD COLUMN IF NOT EXISTS attribution text;

CREATE UNIQUE INDEX IF NOT EXISTS restaurants_osm_id_key ON public.restaurants (osm_id) WHERE osm_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS restaurants_foursquare_id_key ON public.restaurants (foursquare_id) WHERE foursquare_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS restaurants_yelp_id_key ON public.restaurants (yelp_id) WHERE yelp_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.external_api_budget (
  provider text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  monthly_limit_usd numeric NOT NULL DEFAULT 10,
  cost_per_1k_usd numeric NOT NULL DEFAULT 15,
  month text NOT NULL DEFAULT to_char(now(), 'YYYY-MM'),
  calls integer NOT NULL DEFAULT 0,
  spend_usd numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.external_api_budget TO service_role;
ALTER TABLE public.external_api_budget ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER external_api_budget_touch BEFORE UPDATE ON public.external_api_budget
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.external_api_budget (provider, enabled, monthly_limit_usd, cost_per_1k_usd)
VALUES
  ('foursquare', false, 10, 15),
  ('yelp', false, 10, 0),
  ('google_places', false, 0, 17)
ON CONFLICT (provider) DO NOTHING;