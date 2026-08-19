REVOKE EXECUTE ON FUNCTION public.bump_photo_like(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_photo_like(text, integer) TO service_role;