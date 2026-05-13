
-- Customers + per-customer objects (Objekte)
CREATE TABLE public.customers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  address text,
  postal_code text,
  city text,
  phone text,
  email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customers_user_idx ON public.customers (user_id);
CREATE INDEX customers_user_name_idx ON public.customers (user_id, lower(name));

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own customers select" ON public.customers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own customers insert" ON public.customers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own customers update" ON public.customers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own customers delete" ON public.customers FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER customers_set_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.customer_objects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  label text NOT NULL,
  address text,
  postal_code text,
  city text,
  notes text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_objects_customer_idx ON public.customer_objects (customer_id);
CREATE INDEX customer_objects_user_idx ON public.customer_objects (user_id);

ALTER TABLE public.customer_objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own objects select" ON public.customer_objects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own objects insert" ON public.customer_objects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own objects update" ON public.customer_objects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own objects delete" ON public.customer_objects FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER customer_objects_set_updated_at
  BEFORE UPDATE ON public.customer_objects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
