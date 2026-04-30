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
    (NEW.id, 'Malermeister',       0, 1, false),
    (NEW.id, 'Projektleiter',      0, 2, false),
    (NEW.id, 'Maler Geselle',      0, 3, true),
    (NEW.id, 'Junggeselle',        0, 4, false),
    (NEW.id, 'Azubi 3. Lehrjahr',  0, 5, false),
    (NEW.id, 'Azubi 2. Lehrjahr',  0, 6, false),
    (NEW.id, 'Azubi 1. Lehrjahr',  0, 7, false),
    (NEW.id, 'Helfer',             0, 8, false);

  RETURN NEW;
END $function$;