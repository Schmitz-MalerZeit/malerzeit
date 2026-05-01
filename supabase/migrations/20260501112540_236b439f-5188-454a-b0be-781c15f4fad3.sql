UPDATE public.user_settings
SET whatsapp_template = 'Hallo {kunde},

vielen Dank für Ihre Anfrage. Hier eine unverbindliche Preisorientierung für die geplanten Arbeiten:

{leistungen}

Gesamtpreis (brutto): {preis}

Sofern sich diese Preisorientierung in Ihrem Rahmen bewegt, erstellen wir Ihnen gerne ein verbindliches schriftliches Angebot.

Mit freundlichen Grüßen
{unterschrift}
{firma}'
WHERE whatsapp_template = 'Hallo {kunde},

vielen Dank für Ihre Anfrage. Hier eine unverbindliche Preisorientierung für die geplanten Arbeiten:

{leistungen}

Gesamtpreis (brutto): {preis}

Sofern sich diese Preisorientierung in Ihrem Rahmen bewegt, erstellen wir Ihnen gerne ein verbindliches schriftliches Angebot.';