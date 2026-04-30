-- Subscriptions table
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  paddle_subscription_id text not null unique,
  paddle_customer_id text not null,
  product_id text not null,
  price_id text not null,
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  environment text not null default 'sandbox',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_subscriptions_user_id on public.subscriptions(user_id);
create index idx_subscriptions_paddle_id on public.subscriptions(paddle_subscription_id);

alter table public.subscriptions enable row level security;

create policy "Users can view own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create policy "Service role can manage subscriptions"
  on public.subscriptions for all
  using (auth.role() = 'service_role');

-- Trial tracking on profiles (14 days from signup, no card required)
alter table public.profiles
  add column if not exists trial_ends_at timestamptz default (now() + interval '14 days');

-- Backfill existing users
update public.profiles set trial_ends_at = created_at + interval '14 days' where trial_ends_at is null;

-- PDF usage counter (monthly, resets via period_start logic)
create table public.pdf_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  period_start date not null,
  count integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, period_start)
);

alter table public.pdf_usage enable row level security;

create policy "own usage select" on public.pdf_usage for select using (auth.uid() = user_id);
create policy "own usage insert" on public.pdf_usage for insert with check (auth.uid() = user_id);
create policy "own usage update" on public.pdf_usage for update using (auth.uid() = user_id);

-- Helpers
create or replace function public.has_active_subscription(
  user_uuid uuid,
  check_env text default 'live'
)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = user_uuid
    and environment = check_env
    and (
      (status in ('active', 'trialing') and (current_period_end is null or current_period_end > now()))
      or (status = 'canceled' and current_period_end > now())
    )
  );
$$;

-- Tier limits helper
create or replace function public.get_pdf_limit(price_id text)
returns integer language sql immutable as $$
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