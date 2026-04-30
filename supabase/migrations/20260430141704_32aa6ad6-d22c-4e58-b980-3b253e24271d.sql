
-- Atomic, server-side quota check and increment
CREATE OR REPLACE FUNCTION public.consume_pdf_quota()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_period date := date_trunc('month', now())::date;
  v_limit int := 0;
  v_used int := 0;
  v_price_id text;
  v_status text;
  v_period_end timestamptz;
  v_trial_ends timestamptz;
  v_in_trial boolean := false;
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

  -- Trial info
  SELECT trial_ends_at INTO v_trial_ends FROM public.profiles WHERE id = v_user;
  v_in_trial := v_trial_ends IS NOT NULL AND v_trial_ends > now()
                AND (v_status IS NULL OR v_status = 'canceled');

  -- Determine limit
  IF v_price_id IS NOT NULL AND (
    (v_status IN ('active','trialing','past_due') AND (v_period_end IS NULL OR v_period_end > now()))
    OR (v_status = 'canceled' AND v_period_end IS NOT NULL AND v_period_end > now())
  ) THEN
    v_limit := public.get_pdf_limit(v_price_id);
  ELSIF v_in_trial THEN
    v_limit := 50;
  ELSE
    v_limit := 0;
  END IF;

  IF v_limit <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_active_plan', 'limit', 0, 'used', 0);
  END IF;

  -- Atomic upsert + read-back of new count
  INSERT INTO public.pdf_usage (user_id, period_start, count)
  VALUES (v_user, v_period, 1)
  ON CONFLICT (user_id, period_start)
  DO UPDATE SET count = public.pdf_usage.count + 1, updated_at = now()
  WHERE public.pdf_usage.count < v_limit
  RETURNING count INTO v_used;

  IF v_used IS NULL THEN
    -- Conflict path with WHERE failing means limit already reached
    SELECT count INTO v_used FROM public.pdf_usage
      WHERE user_id = v_user AND period_start = v_period;
    RETURN jsonb_build_object('ok', false, 'error', 'limit_reached', 'limit', v_limit, 'used', COALESCE(v_used, v_limit));
  END IF;

  RETURN jsonb_build_object('ok', true, 'limit', v_limit, 'used', v_used);
END;
$$;

-- Need a unique constraint for the ON CONFLICT target
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pdf_usage_user_period_unique'
  ) THEN
    ALTER TABLE public.pdf_usage
      ADD CONSTRAINT pdf_usage_user_period_unique UNIQUE (user_id, period_start);
  END IF;
END$$;

REVOKE ALL ON FUNCTION public.consume_pdf_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_pdf_quota() TO authenticated;
