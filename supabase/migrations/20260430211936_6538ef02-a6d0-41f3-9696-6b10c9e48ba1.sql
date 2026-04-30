CREATE OR REPLACE FUNCTION public.reset_my_pdf_quota()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_allowed_user constant uuid := '4f497125-b2e8-46af-a6ef-477dbe7a8a0c';
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  IF v_user <> v_allowed_user THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  DELETE FROM public.pdf_usage WHERE user_id = v_user;

  RETURN jsonb_build_object('ok', true);
END;
$$;