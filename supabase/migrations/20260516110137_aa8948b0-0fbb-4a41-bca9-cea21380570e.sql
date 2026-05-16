CREATE TABLE IF NOT EXISTS public.smtp_delivery_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  trace_id text NOT NULL,
  phase text NOT NULL,
  smtp_host text,
  smtp_port integer,
  smtp_secure text,
  auth_user_present boolean NOT NULL DEFAULT false,
  auth_pass_present boolean NOT NULL DEFAULT false,
  auth_pass_length integer,
  auth_pass_fingerprint text,
  password_has_outer_whitespace boolean,
  password_contains_newline boolean,
  from_address text,
  from_header text,
  recipient text,
  settings_found boolean NOT NULL DEFAULT false,
  credentials_found boolean NOT NULL DEFAULT false,
  settings_updated_at timestamptz,
  credentials_updated_at timestamptz,
  settings_user_id uuid,
  credentials_user_id uuid,
  credential_source text,
  error_message text
);

ALTER TABLE public.smtp_delivery_diagnostics ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_smtp_delivery_diagnostics_user_created
  ON public.smtp_delivery_diagnostics (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_smtp_delivery_diagnostics_trace
  ON public.smtp_delivery_diagnostics (trace_id, created_at DESC);