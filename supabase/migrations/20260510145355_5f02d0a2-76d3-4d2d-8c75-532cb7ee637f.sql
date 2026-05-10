create table public.affiliates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  notes text,
  commission_percent numeric not null check (commission_percent > 0 and commission_percent <= 100),
  discount_code text not null,
  paddle_discount_id text not null,
  environment text not null check (environment in ('sandbox','live')),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (paddle_discount_id, environment)
);

alter table public.affiliates enable row level security;

create policy "admins manage affiliates"
  on public.affiliates for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create trigger trg_affiliates_updated_at
  before update on public.affiliates
  for each row execute function public.set_updated_at();

create index idx_affiliates_env on public.affiliates(environment, archived);