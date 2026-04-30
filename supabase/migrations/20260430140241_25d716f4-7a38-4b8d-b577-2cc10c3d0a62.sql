-- Fix search_path on get_pdf_limit
create or replace function public.get_pdf_limit(price_id text)
returns integer language sql immutable set search_path = public as $$
  select case price_id
    when 'starter_monthly' then 15
    when 'starter_yearly'  then 15
    when 'profi_monthly'   then 50
    when 'profi_yearly'    then 50
    when 'profiplus_monthly' then 200
    when 'profiplus_yearly'  then 200
    else 0
  end;
$$;

-- Lock down EXECUTE on SECURITY DEFINER function
revoke execute on function public.has_active_subscription(uuid, text) from public, anon;
grant execute on function public.has_active_subscription(uuid, text) to authenticated, service_role;