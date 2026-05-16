DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_smtp_credentials'
      AND policyname = 'service role manages smtp credentials'
  ) THEN
    CREATE POLICY "service role manages smtp credentials"
    ON public.user_smtp_credentials
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;