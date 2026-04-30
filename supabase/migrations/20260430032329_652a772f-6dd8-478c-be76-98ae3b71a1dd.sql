ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_address text,
  ADD COLUMN IF NOT EXISTS customer_postal_code text,
  ADD COLUMN IF NOT EXISTS customer_city text;