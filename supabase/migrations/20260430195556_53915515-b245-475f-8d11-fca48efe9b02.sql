ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS quote_validity_days integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS closing_text text NOT NULL DEFAULT 'Sollte Ihnen unser Angebot zusagen, freuen wir uns über Ihre Auftragszusage.';