CREATE POLICY "service role manages smtp diagnostics"
ON public.smtp_delivery_diagnostics
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');