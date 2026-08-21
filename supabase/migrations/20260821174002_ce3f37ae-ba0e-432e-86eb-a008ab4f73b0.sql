-- Inline explicit staff role checks so no new SECURITY DEFINER function is exposed.
DROP POLICY IF EXISTS "Staff can create items" ON public.content_items;
CREATE POLICY "Staff can create items" ON public.content_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('admin'::app_role,'editor'::app_role)));

DROP POLICY IF EXISTS "Staff can read every item" ON public.content_items;
CREATE POLICY "Staff can read every item" ON public.content_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('admin'::app_role,'editor'::app_role)));

DROP POLICY IF EXISTS "Staff can update items" ON public.content_items;
CREATE POLICY "Staff can update items" ON public.content_items
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('admin'::app_role,'editor'::app_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('admin'::app_role,'editor'::app_role)));

DROP POLICY IF EXISTS "Staff can read every claim" ON public.directory_claims;
CREATE POLICY "Staff can read every claim" ON public.directory_claims
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('admin'::app_role,'editor'::app_role)));

DROP POLICY IF EXISTS "Staff can review claims" ON public.directory_claims;
CREATE POLICY "Staff can review claims" ON public.directory_claims
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('admin'::app_role,'editor'::app_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('admin'::app_role,'editor'::app_role)));

DROP POLICY IF EXISTS "Staff can read every thread" ON public.forum_threads;
CREATE POLICY "Staff can read every thread" ON public.forum_threads
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('admin'::app_role,'editor'::app_role)));

DROP POLICY IF EXISTS "Staff can moderate threads" ON public.forum_threads;
CREATE POLICY "Staff can moderate threads" ON public.forum_threads
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('admin'::app_role,'editor'::app_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('admin'::app_role,'editor'::app_role)));

DROP POLICY IF EXISTS "Staff can read every reply" ON public.forum_replies;
CREATE POLICY "Staff can read every reply" ON public.forum_replies
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('admin'::app_role,'editor'::app_role)));

DROP POLICY IF EXISTS "Staff can moderate replies" ON public.forum_replies;
CREATE POLICY "Staff can moderate replies" ON public.forum_replies
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('admin'::app_role,'editor'::app_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('admin'::app_role,'editor'::app_role)));

DROP FUNCTION IF EXISTS public.has_staff_role(uuid);