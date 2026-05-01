-- 1) Add-On-Tabelle
create table public.pdf_addons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  pdfs_added int not null check (pdfs_added > 0),
  price_id text not null,
  paddle_transaction_id text unique,
  environment text not null default 'sandbox',
  created_at timestamptz not null default now()
);

create index idx_pdf_addons_user_period on public.pdf_addons(user_id, period_start);

alter table public.pdf_addons enable row level security;

create policy "own addons select" on public.pdf_addons
  for select using (auth.uid() = user_id);

create policy "service role manages addons" on public.pdf_addons
  for all using (auth.role() = 'service_role');

-- 2) consume_pdf_quota: Add-Ons zum Monatslimit dazurechnen
create or replace function public.consume_pdf_quota()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
  v_trial_limit constant int := 3;
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

  -- Trial-Modus unverändert
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
$$;

-- 3) get_quota_status: Frontend-Helfer (Verbrauch + Limit + Add-Ons)
create or replace function public.get_quota_status()
returns jsonb
language plpgsql
stable security definer
set search_path = public
as $$
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
  v_trial_limit constant int := 3;
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
$$;

-- 4) grant_pdf_addon: vom Webhook genutzt (Service Role)
create or replace function public.grant_pdf_addon(
  p_user_id uuid,
  p_price_id text,
  p_paddle_transaction_id text,
  p_environment text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period date := date_trunc('month', now())::date;
  v_pdfs int;
begin
  v_pdfs := case p_price_id
    when 'addon_10_pdfs' then 10
    when 'addon_20_pdfs' then 20
    else 0
  end;

  if v_pdfs = 0 then
    return jsonb_build_object('ok', false, 'error', 'unknown_addon_price');
  end if;

  insert into public.pdf_addons (user_id, period_start, pdfs_added, price_id, paddle_transaction_id, environment)
  values (p_user_id, v_period, v_pdfs, p_price_id, p_paddle_transaction_id, p_environment)
  on conflict (paddle_transaction_id) do nothing;

  return jsonb_build_object('ok', true, 'pdfs_added', v_pdfs);
end;
$$;