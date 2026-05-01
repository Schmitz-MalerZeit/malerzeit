ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS email_template text NOT NULL DEFAULT
'Hallo {kunde},

vielen Dank für Ihre Anfrage. Anbei erhalten Sie unsere unverbindliche Preisorientierung für die geplanten Arbeiten:

{leistungen}

Gesamtpreis (brutto): {preis}

Sofern sich diese Preisorientierung in Ihrem Rahmen bewegt, erstellen wir Ihnen gerne ein verbindliches schriftliches Angebot.',
  ADD COLUMN IF NOT EXISTS whatsapp_template text NOT NULL DEFAULT
'Hallo {kunde},

vielen Dank für Ihre Anfrage. Hier eine unverbindliche Preisorientierung für die geplanten Arbeiten:

{leistungen}

Gesamtpreis (brutto): {preis}

Sofern sich diese Preisorientierung in Ihrem Rahmen bewegt, erstellen wir Ihnen gerne ein verbindliches schriftliches Angebot.';