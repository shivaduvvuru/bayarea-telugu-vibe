CREATE TABLE public.leads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign text NOT NULL DEFAULT 'brigade-barcelona',
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  preferred_city text,
  preferred_dates text,
  message text,
  source_page text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT INSERT ON public.leads TO anon;
GRANT SELECT, INSERT ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a lead"
  ON public.leads FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(btrim(name)) BETWEEN 2 AND 120
    AND length(btrim(email)) BETWEEN 5 AND 200
    AND coalesce(length(message), 0) <= 1500
  );

CREATE POLICY "Staff can read leads"
  ON public.leads FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE TRIGGER leads_touch
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();