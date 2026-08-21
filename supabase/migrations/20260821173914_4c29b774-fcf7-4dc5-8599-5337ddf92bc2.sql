CREATE OR REPLACE FUNCTION public.has_staff_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::app_role, 'editor'::app_role)
      AND (_user_id = auth.uid() OR auth.role() = 'service_role')
  )
$$;

REVOKE ALL ON FUNCTION public.has_staff_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_staff_role(uuid) TO authenticated, service_role;

-- content_items
DROP POLICY IF EXISTS "Staff can create items" ON public.content_items;
CREATE POLICY "Staff can create items" ON public.content_items
  FOR INSERT TO authenticated
  WITH CHECK (public.has_staff_role(auth.uid()));

DROP POLICY IF EXISTS "Staff can read every item" ON public.content_items;
CREATE POLICY "Staff can read every item" ON public.content_items
  FOR SELECT TO authenticated
  USING (public.has_staff_role(auth.uid()));

DROP POLICY IF EXISTS "Staff can update items" ON public.content_items;
CREATE POLICY "Staff can update items" ON public.content_items
  FOR UPDATE TO authenticated
  USING (public.has_staff_role(auth.uid()))
  WITH CHECK (public.has_staff_role(auth.uid()));

-- directory_claims
DROP POLICY IF EXISTS "Staff can read every claim" ON public.directory_claims;
CREATE POLICY "Staff can read every claim" ON public.directory_claims
  FOR SELECT TO authenticated
  USING (public.has_staff_role(auth.uid()));

DROP POLICY IF EXISTS "Staff can review claims" ON public.directory_claims;
CREATE POLICY "Staff can review claims" ON public.directory_claims
  FOR UPDATE TO authenticated
  USING (public.has_staff_role(auth.uid()))
  WITH CHECK (public.has_staff_role(auth.uid()));

-- forum_threads
DROP POLICY IF EXISTS "Staff can read every thread" ON public.forum_threads;
CREATE POLICY "Staff can read every thread" ON public.forum_threads
  FOR SELECT TO authenticated
  USING (public.has_staff_role(auth.uid()));

DROP POLICY IF EXISTS "Staff can moderate threads" ON public.forum_threads;
CREATE POLICY "Staff can moderate threads" ON public.forum_threads
  FOR UPDATE TO authenticated
  USING (public.has_staff_role(auth.uid()))
  WITH CHECK (public.has_staff_role(auth.uid()));

-- forum_replies
DROP POLICY IF EXISTS "Staff can read every reply" ON public.forum_replies;
CREATE POLICY "Staff can read every reply" ON public.forum_replies
  FOR SELECT TO authenticated
  USING (public.has_staff_role(auth.uid()));

DROP POLICY IF EXISTS "Staff can moderate replies" ON public.forum_replies;
CREATE POLICY "Staff can moderate replies" ON public.forum_replies
  FOR UPDATE TO authenticated
  USING (public.has_staff_role(auth.uid()))
  WITH CHECK (public.has_staff_role(auth.uid()));

-- user_roles: remove misnamed duplicate policy; own-roles policy remains
DROP POLICY IF EXISTS "Admins can read all roles" ON public.user_roles;