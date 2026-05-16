UPDATE public.user_settings
SET smtp_port = 465,
    smtp_secure = 'ssl'
WHERE lower(coalesce(smtp_host, '')) LIKE '%df.eu%'
  AND smtp_port IN (993, 995, 143, 110);
