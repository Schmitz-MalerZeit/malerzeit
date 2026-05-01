UPDATE public.user_settings
SET whatsapp_template = trim(whatsapp_template) || E'\n\nMit freundlichen Grüßen\n{unterschrift}\n{firma}',
    updated_at = now()
WHERE whatsapp_template IS NOT NULL
  AND whatsapp_template !~* 'mit\s+freundlichen\s+gr[üu](ß|ss)en';

ALTER TABLE public.user_settings
ALTER COLUMN whatsapp_template SET DEFAULT 'Hallo {kunde},

vielen Dank für Ihre Anfrage. Hier eine unverbindliche Preisorientierung für die geplanten Arbeiten:

{leistungen}

Gesamtpreis (brutto): {preis}

Sofern sich diese Preisorientierung in Ihrem Rahmen bewegt, erstellen wir Ihnen gerne ein verbindliches schriftliches Angebot.

Mit freundlichen Grüßen
{unterschrift}
{firma}';