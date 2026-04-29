
-- Lock down SECURITY DEFINER fns (set_updated_at is INVOKER, but tighten anyway)
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Replace broad SELECT on logos with owner-only listing; keep public read via direct URL with a separate USING that matches by name path
DROP POLICY IF EXISTS "logos public read" ON storage.objects;
CREATE POLICY "logos owner list" ON storage.objects FOR SELECT
  USING (bucket_id = 'company-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
