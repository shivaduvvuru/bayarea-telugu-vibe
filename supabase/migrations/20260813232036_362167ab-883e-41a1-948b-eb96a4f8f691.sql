GRANT SELECT, UPDATE ON public.digest_queue TO anon;

DROP POLICY IF EXISTS "desk open read" ON public.digest_queue;
CREATE POLICY "desk open read" ON public.digest_queue FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "desk open update" ON public.digest_queue;
CREATE POLICY "desk open update" ON public.digest_queue FOR UPDATE TO anon USING (true) WITH CHECK (true);