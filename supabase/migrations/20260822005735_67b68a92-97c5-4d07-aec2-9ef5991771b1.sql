-- ============ RESTAURANTS ============
CREATE TABLE public.restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  branch_label text,
  description text,
  address text,
  city text,
  region text,
  latitude numeric,
  longitude numeric,
  cuisines text[] NOT NULL DEFAULT '{}',
  restaurant_types text[] NOT NULL DEFAULT '{}',
  dish_tags text[] NOT NULL DEFAULT '{}',
  features text[] NOT NULL DEFAULT '{}',
  dietary text[] NOT NULL DEFAULT '{}',
  phone text,
  website_url text,
  menu_url text,
  hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  hours_text text,
  price_level integer,
  has_delivery boolean NOT NULL DEFAULT false,
  has_pickup boolean NOT NULL DEFAULT false,
  has_dine_in boolean NOT NULL DEFAULT true,
  has_reservations boolean NOT NULL DEFAULT false,
  has_catering boolean NOT NULL DEFAULT false,
  order_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  reservation_url text,
  photos text[] NOT NULL DEFAULT '{}',
  sponsored boolean NOT NULL DEFAULT false,
  verified boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'published',
  source text NOT NULL DEFAULT 'editorial',
  dedupe_key text,
  opened_at date,
  last_refreshed_at timestamptz,
  refresh_failures integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX restaurants_city_idx ON public.restaurants (city);
CREATE INDEX restaurants_status_idx ON public.restaurants (status);
CREATE INDEX restaurants_cuisines_idx ON public.restaurants USING gin (cuisines);
CREATE INDEX restaurants_dish_tags_idx ON public.restaurants USING gin (dish_tags);
CREATE UNIQUE INDEX restaurants_dedupe_idx ON public.restaurants (dedupe_key) WHERE dedupe_key IS NOT NULL;

GRANT SELECT ON public.restaurants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurants TO authenticated;
GRANT ALL ON public.restaurants TO service_role;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "restaurants_public_read" ON public.restaurants FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY "restaurants_staff_read" ON public.restaurants FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "restaurants_staff_insert" ON public.restaurants FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "restaurants_staff_update" ON public.restaurants FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "restaurants_staff_delete" ON public.restaurants FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));
CREATE TRIGGER restaurants_touch BEFORE UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ EXTERNAL RATINGS ============
CREATE TABLE public.restaurant_ratings (
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  source text NOT NULL,
  rating numeric,
  review_count integer,
  external_url text,
  fetched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (restaurant_id, source)
);
GRANT SELECT ON public.restaurant_ratings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_ratings TO authenticated;
GRANT ALL ON public.restaurant_ratings TO service_role;
ALTER TABLE public.restaurant_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ratings_public_read" ON public.restaurant_ratings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "ratings_staff_write" ON public.restaurant_ratings FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER restaurant_ratings_touch BEFORE UPDATE ON public.restaurant_ratings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ COMMUNITY REVIEWS ============
CREATE TABLE public.restaurant_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text NOT NULL DEFAULT 'Community member',
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text,
  dishes text[] NOT NULL DEFAULT '{}',
  photos text[] NOT NULL DEFAULT '{}',
  veg_favorite boolean NOT NULL DEFAULT false,
  family_friendly boolean NOT NULL DEFAULT false,
  recommends boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, user_id)
);
CREATE INDEX restaurant_reviews_restaurant_idx ON public.restaurant_reviews (restaurant_id);
GRANT SELECT ON public.restaurant_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_reviews TO authenticated;
GRANT ALL ON public.restaurant_reviews TO service_role;
ALTER TABLE public.restaurant_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_public_read" ON public.restaurant_reviews FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY "reviews_own_read" ON public.restaurant_reviews FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "reviews_own_insert" ON public.restaurant_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews_own_update" ON public.restaurant_reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews_own_delete" ON public.restaurant_reviews FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "reviews_staff_manage" ON public.restaurant_reviews FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER restaurant_reviews_touch BEFORE UPDATE ON public.restaurant_reviews FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ DEALS ============
CREATE TABLE public.restaurant_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  deal_type text NOT NULL DEFAULT 'discount',
  code text,
  url text,
  city text,
  cuisine text,
  sponsored boolean NOT NULL DEFAULT false,
  starts_at timestamptz,
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.restaurant_deals TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_deals TO authenticated;
GRANT ALL ON public.restaurant_deals TO service_role;
ALTER TABLE public.restaurant_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deals_public_read" ON public.restaurant_deals FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY "deals_staff_manage" ON public.restaurant_deals FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER restaurant_deals_touch BEFORE UPDATE ON public.restaurant_deals FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ OWNER SUBMISSIONS ============
CREATE TABLE public.restaurant_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'claim',
  restaurant_name text NOT NULL,
  city text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.restaurant_claims TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_claims TO authenticated;
GRANT ALL ON public.restaurant_claims TO service_role;
ALTER TABLE public.restaurant_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "restaurant_claims_public_insert" ON public.restaurant_claims FOR INSERT TO anon, authenticated WITH CHECK (status = 'pending');
CREATE POLICY "restaurant_claims_staff_read" ON public.restaurant_claims FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "restaurant_claims_staff_update" ON public.restaurant_claims FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "restaurant_claims_staff_delete" ON public.restaurant_claims FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));
CREATE TRIGGER restaurant_claims_touch BEFORE UPDATE ON public.restaurant_claims FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.restaurant_claim_contacts (
  claim_id uuid PRIMARY KEY REFERENCES public.restaurant_claims(id) ON DELETE CASCADE,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  contact_role text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.restaurant_claim_contacts TO anon;
GRANT INSERT ON public.restaurant_claim_contacts TO authenticated;
GRANT ALL ON public.restaurant_claim_contacts TO service_role;
ALTER TABLE public.restaurant_claim_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claim_contacts_public_insert" ON public.restaurant_claim_contacts FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ============ EDITORIAL COLLECTIONS ============
CREATE TABLE public.food_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  city text,
  cuisine text,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.food_collections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_collections TO authenticated;
GRANT ALL ON public.food_collections TO service_role;
ALTER TABLE public.food_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "food_collections_public_read" ON public.food_collections FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY "food_collections_staff_manage" ON public.food_collections FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER food_collections_touch BEFORE UPDATE ON public.food_collections FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.food_collection_items (
  collection_id uuid NOT NULL REFERENCES public.food_collections(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, restaurant_id)
);
GRANT SELECT ON public.food_collection_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_collection_items TO authenticated;
GRANT ALL ON public.food_collection_items TO service_role;
ALTER TABLE public.food_collection_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "food_collection_items_public_read" ON public.food_collection_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "food_collection_items_staff_manage" ON public.food_collection_items FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ============ STARTER COLLECTIONS ============
INSERT INTO public.food_collections (slug, title, description, sort_order) VALUES
  ('best-biryani', 'Best Biryani in the Bay Area', 'Editor-picked biryani houses across the South Bay and East Bay.', 10),
  ('south-indian-breakfast', 'Best South Indian Breakfast', 'Dosa, idli, pesarattu and filter coffee worth an early start.', 20),
  ('telugu-community-favorites', 'Telugu Community Favorites', 'The places our readers keep going back to.', 30),
  ('best-in-fremont', 'Best Restaurants in Fremont', 'Fremont favourites across every cuisine.', 40),
  ('family-dining', 'Best Restaurants for Families', 'Roomy, quick and kid-friendly.', 50),
  ('open-late', 'Restaurants Open Late', 'Late-night kitchens across the Bay.', 60);