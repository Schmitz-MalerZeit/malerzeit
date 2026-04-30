ALTER TABLE public.user_settings
  ALTER COLUMN closing_text SET DEFAULT 'Sofern sich diese Preisorientierung in Ihrem Rahmen bewegt, erstellen wir Ihnen gerne ein verbindliches schriftliches Angebot.';

UPDATE public.user_settings
SET closing_text = 'Sofern sich diese Preisorientierung in Ihrem Rahmen bewegt, erstellen wir Ihnen gerne ein verbindliches schriftliches Angebot.'
WHERE closing_text = 'Sollte Ihnen unser Angebot zusagen, freuen wir uns über Ihre Auftragszusage.';