-- Profile erweitern
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS vat_id text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS city text;

-- Stundensätze
CREATE TABLE IF NOT EXISTS public.hourly_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  label text NOT NULL,
  rate numeric NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hourly_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own rates select" ON public.hourly_rates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own rates insert" ON public.hourly_rates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own rates update" ON public.hourly_rates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own rates delete" ON public.hourly_rates FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_hourly_rates_updated_at
  BEFORE UPDATE ON public.hourly_rates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_hourly_rates_user ON public.hourly_rates(user_id, sort_order);

-- handle_new_user erweitern: Standard-Rollen anlegen
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, contact_person)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_settings (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.hourly_rates (user_id, label, rate, sort_order, is_default) VALUES
    (NEW.id, 'Malermeister',       75, 1, false),
    (NEW.id, 'Projektleiter',      70, 2, false),
    (NEW.id, 'Maler Geselle',      55, 3, true),
    (NEW.id, 'Junggeselle',        48, 4, false),
    (NEW.id, 'Azubi 3. Lehrjahr',  35, 5, false),
    (NEW.id, 'Azubi 2. Lehrjahr',  30, 6, false),
    (NEW.id, 'Azubi 1. Lehrjahr',  25, 7, false),
    (NEW.id, 'Helfer',             40, 8, false);

  RETURN NEW;
END $function$;

-- Trigger anlegen falls nicht vorhanden
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- Bestehende Nutzer ohne Rollen befüllen
INSERT INTO public.hourly_rates (user_id, label, rate, sort_order, is_default)
SELECT p.id, x.label, x.rate, x.sort_order, x.is_default
FROM public.profiles p
CROSS JOIN (VALUES
  ('Malermeister'::text, 75::numeric, 1, false),
  ('Projektleiter', 70, 2, false),
  ('Maler Geselle', 55, 3, true),
  ('Junggeselle', 48, 4, false),
  ('Azubi 3. Lehrjahr', 35, 5, false),
  ('Azubi 2. Lehrjahr', 30, 6, false),
  ('Azubi 1. Lehrjahr', 25, 7, false),
  ('Helfer', 40, 8, false)
) AS x(label, rate, sort_order, is_default)
WHERE NOT EXISTS (SELECT 1 FROM public.hourly_rates hr WHERE hr.user_id = p.id);