-- Update consume_pdf_quota: trial = 3 lifetime PDFs instead of 50/month
CREATE OR REPLACE FUNCTION public.consume_pdf_quota()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_period date := date_trunc('month', now())::date;
  v_limit int := 0;
  v_used int := 0;
  v_price_id text;
  v_status text;
  v_period_end timestamptz;
  v_has_paid_plan boolean := false;
  v_trial_total_used int := 0;
  v_trial_limit constant int := 3;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  -- Look up most recent subscription (any environment, prefer live)
  SELECT price_id, status, current_period_end
    INTO v_price_id, v_status, v_period_end
  FROM public.subscriptions
  WHERE user_id = v_user
  ORDER BY (environment = 'live') DESC, created_at DESC
  LIMIT 1;

  -- Determine if there's an active paid plan
  v_has_paid_plan := v_price_id IS NOT NULL AND (
    (v_status IN ('active','trialing','past_due') AND (v_period_end IS NULL OR v_period_end > now()))
    OR (v_status = 'canceled' AND v_period_end IS NOT NULL AND v_period_end > now())
  );

  IF v_has_paid_plan THEN
    -- Paid plan: monthly limit, monthly reset (existing behavior)
    v_limit := public.get_pdf_limit(v_price_id);

    IF v_limit <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'no_active_plan', 'limit', 0, 'used', 0);
    END IF;

    INSERT INTO public.pdf_usage (user_id, period_start, count)
    VALUES (v_user, v_period, 1)
    ON CONFLICT (user_id, period_start)
    DO UPDATE SET count = public.pdf_usage.count + 1, updated_at = now()
    WHERE public.pdf_usage.count < v_limit
    RETURNING count INTO v_used;

    IF v_used IS NULL THEN
      SELECT count INTO v_used FROM public.pdf_usage
        WHERE user_id = v_user AND period_start = v_period;
      RETURN jsonb_build_object('ok', false, 'error', 'limit_reached', 'limit', v_limit, 'used', COALESCE(v_used, v_limit));
    END IF;

    RETURN jsonb_build_object('ok', true, 'limit', v_limit, 'used', v_used, 'mode', 'paid');
  END IF;

  -- No paid plan: trial mode = 3 lifetime PDFs (sum across all periods)
  SELECT COALESCE(SUM(count), 0)::int INTO v_trial_total_used
  FROM public.pdf_usage
  WHERE user_id = v_user;

  IF v_trial_total_used >= v_trial_limit THEN
    RETURN jsonb_build_object(
      'ok', false, 'error', 'trial_exhausted',
      'limit', v_trial_limit, 'used', v_trial_total_used, 'mode', 'trial'
    );
  END IF;

  -- Increment usage in current month bucket
  INSERT INTO public.pdf_usage (user_id, period_start, count)
  VALUES (v_user, v_period, 1)
  ON CONFLICT (user_id, period_start)
  DO UPDATE SET count = public.pdf_usage.count + 1, updated_at = now()
  RETURNING count INTO v_used;

  -- Recompute total after increment
  SELECT COALESCE(SUM(count), 0)::int INTO v_trial_total_used
  FROM public.pdf_usage
  WHERE user_id = v_user;

  RETURN jsonb_build_object(
    'ok', true, 'mode', 'trial',
    'limit', v_trial_limit, 'used', v_trial_total_used
  );
END;
$function$;

-- Helper: read-only trial / quota status for the UI counter
CREATE OR REPLACE FUNCTION public.get_trial_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_price_id text;
  v_status text;
  v_period_end timestamptz;
  v_has_paid_plan boolean := false;
  v_trial_total_used int := 0;
  v_trial_limit constant int := 3;
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