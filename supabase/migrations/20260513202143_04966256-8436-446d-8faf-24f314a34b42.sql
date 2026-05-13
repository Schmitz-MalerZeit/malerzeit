
-- Storage bucket for quote photos (private)
insert into storage.buckets (id, name, public)
values ('quote-photos', 'quote-photos', false)
on conflict (id) do nothing;

-- Storage policies: users can read/write only their own folder ({user_id}/...)
create policy "own quote photos read"
on storage.objects for select
to authenticated
using (bucket_id = 'quote-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "own quote photos insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'quote-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "own quote photos update"
on storage.objects for update
to authenticated
using (bucket_id = 'quote-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "own quote photos delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'quote-photos' and auth.uid()::text = (storage.foldername(name))[1]);

-- Quote photos table
create table public.quote_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  section_id text not null,
  storage_path text not null,
  sort_order int not null default 0,
  width int,
  height int,
  created_at timestamptz not null default now()
);

create index quote_photos_quote_id_idx on public.quote_photos(quote_id);
create index quote_photos_quote_section_idx on public.quote_photos(quote_id, section_id);

alter table public.quote_photos enable row level security;

create policy "own quote photos select"
on public.quote_photos for select
to authenticated
using (auth.uid() = user_id);

create policy "own quote photos insert"
on public.quote_photos for insert
to authenticated
with check (auth.uid() = user_id);

create policy "own quote photos update"
on public.quote_photos for update
to authenticated
using (auth.uid() = user_id);

create policy "own quote photos delete"
on public.quote_photos for delete
to authenticated
using (auth.uid() = user_id);
