REVOKE EXECUTE ON FUNCTION public.reset_my_pdf_quota() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_quota_status() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_trial_status() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.consume_pdf_quota() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.grant_pdf_addon(uuid, text, text, text) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.reset_my_pdf_quota() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_quota_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trial_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_pdf_quota() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;