ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS salutation text;
ALTER TABLE public.quotes    ADD COLUMN IF NOT EXISTS customer_salutation text;