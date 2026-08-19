CREATE POLICY "Service role manages picture intake"
ON public.picture_intake
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);