CREATE OR REPLACE FUNCTION public.get_quota_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_period date := date_trunc('month', now())::date;
  v_price_id text;
  v_status text;
  v_period_end timestamptz;
  v_has_paid_plan boolean := false;
  v_base_limit int := 0;
  v_addon_bonus int := 0;
  v_used int := 0;
  v_trial_total_used int := 0;
  v_trial_limit constant int := 2;
begin
  if v_user is null then
    return jsonb_build_object('mode', 'anonymous');
  end if;

  select price_id, status, current_period_end
    into v_price_id, v_status, v_period_end
  from public.subscriptions
  where user_id = v_user
  order by (environment = 'live') desc, created_at desc
  limit 1;

  v_has_paid_plan := v_price_id is not null and (
    (v_status in ('active','trialing','past_due') and (v_period_end is null or v_period_end > now()))
    or (v_status = 'canceled' and v_period_end is not null and v_period_end > now())
  );

  if v_has_paid_plan then
    v_base_limit := public.get_pdf_limit(v_price_id);

    select coalesce(sum(pdfs_added), 0)::int into v_addon_bonus
    from public.pdf_addons
    where user_id = v_user and period_start = v_period;

    select coalesce(count, 0)::int into v_used
    from public.pdf_usage
    where user_id = v_user and period_start = v_period;

    return jsonb_build_object(
      'mode', 'paid',
      'price_id', v_price_id,
      'base_limit', v_base_limit,
      'addon_bonus', v_addon_bonus,
      'limit', v_base_limit + v_addon_bonus,
      'used', coalesce(v_used, 0),
      'left', greatest(0, v_base_limit + v_addon_bonus - coalesce(v_used, 0))
    );
  end if;

  select coalesce(sum(count), 0)::int into v_trial_total_used
  from public.pdf_usage where user_id = v_user;

  return jsonb_build_object(
    'mode', 'trial',
    'limit', v_trial_limit,
    'used', v_trial_total_used,
    'left', greatest(0, v_trial_limit - v_trial_total_used)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.consume_pdf_quota()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_period date := date_trunc('month', now())::date;
  v_base_limit int := 0;
  v_addon_bonus int := 0;
  v_effective_limit int := 0;
  v_used int := 0;
  v_price_id text;
  v_status text;
  v_period_end timestamptz;
  v_has_paid_plan boolean := false;
  v_trial_total_used int := 0;
  v_trial_limit constant int := 2;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  select price_id, status, current_period_end
    into v_price_id, v_status, v_period_end
  from public.subscriptions
  where user_id = v_user
  order by (environment = 'live') desc, created_at desc
  limit 1;

  v_has_paid_plan := v_price_id is not null and (
    (v_status in ('active','trialing','past_due') and (v_period_end is null or v_period_end > now()))
    or (v_status = 'canceled' and v_period_end is not null and v_period_end > now())
  );

  if v_has_paid_plan then
    v_base_limit := public.get_pdf_limit(v_price_id);

    if v_base_limit <= 0 then
      return jsonb_build_object('ok', false, 'error', 'no_active_plan', 'limit', 0, 'used', 0);
    end if;

    select coalesce(sum(pdfs_added), 0)::int into v_addon_bonus
    from public.pdf_addons
    where user_id = v_user and period_start = v_period;

    v_effective_limit := v_base_limit + v_addon_bonus;

    insert into public.pdf_usage (user_id, period_start, count)
    values (v_user, v_period, 1)
    on conflict (user_id, period_start)
    do update set count = public.pdf_usage.count + 1, updated_at = now()
    where public.pdf_usage.count < v_effective_limit
    returning count into v_used;

    if v_used is null then
      select count into v_used from public.pdf_usage
        where user_id = v_user and period_start = v_period;
      return jsonb_build_object(
        'ok', false, 'error', 'limit_reached',
        'limit', v_effective_limit, 'base_limit', v_base_limit,
        'addon_bonus', v_addon_bonus, 'used', coalesce(v_used, v_effective_limit)
      );
    end if;

    return jsonb_build_object(
      'ok', true, 'mode', 'paid',
      'limit', v_effective_limit, 'base_limit', v_base_limit,
      'addon_bonus', v_addon_bonus, 'used', v_used
    );
  end if;

  select coalesce(sum(count), 0)::int into v_trial_total_used
  from public.pdf_usage where user_id = v_user;

  if v_trial_total_used >= v_trial_limit then
    return jsonb_build_object(
      'ok', false, 'error', 'trial_exhausted',
      'limit', v_trial_limit, 'used', v_trial_total_used, 'mode', 'trial'
    );
  end if;

  insert into public.pdf_usage (user_id, period_start, count)
  values (v_user, v_period, 1)
  on conflict (user_id, period_start)
  do update set count = public.pdf_usage.count + 1, updated_at = now()
  returning count into v_used;

  select coalesce(sum(count), 0)::int into v_trial_total_used
  from public.pdf_usage where user_id = v_user;

  return jsonb_build_object(
    'ok', true, 'mode', 'trial',
    'limit', v_trial_limit, 'used', v_trial_total_used
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_trial_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_price_id text;
  v_status text;
  v_period_end timestamptz;
  v_has_paid_plan boolean := false;
  v_trial_total_used int := 0;
  v_trial_limit constant int := 2;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('mode', 'anonymous');
  END IF;

  SELECT price_id, status, current_period_end
    INTO v_price_id, v_status, v_period_end
  FROM public.subscriptions
  WHERE user_id = v_user
  ORDER BY (environment = 'live') DESC, created_at DESC
  LIMIT 1;

  v_has_paid_plan := v_price_id IS NOT NULL AND (
    (v_status IN ('active','trialing','past_due') AND (v_period_end IS NULL OR v_period_end > now()))
    OR (v_status = 'canceled' AND v_period_end IS NOT NULL AND v_period_end > now())
  );

  IF v_has_paid_plan THEN
    RETURN jsonb_build_object('mode', 'paid', 'price_id', v_price_id);
  END IF;

  SELECT COALESCE(SUM(count), 0)::int INTO v_trial_total_used
  FROM public.pdf_usage
  WHERE user_id = v_user;

  RETURN jsonb_build_object(
    'mode', 'trial',
    'limit', v_trial_limit,
    'used', v_trial_total_used,
    'left', GREATEST(0, v_trial_limit - v_trial_total_used)
  );
END;
$function$;