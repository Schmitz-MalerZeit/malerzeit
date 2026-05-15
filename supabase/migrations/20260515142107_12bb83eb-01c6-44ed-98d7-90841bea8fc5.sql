-- Add SMTP fields to user_settings (without password)
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS smtp_from_name text,
  ADD COLUMN IF NOT EXISTS smtp_from_email text,
  ADD COLUMN IF NOT EXISTS smtp_host text,
  ADD COLUMN IF NOT EXISTS smtp_port integer,
  ADD COLUMN IF NOT EXISTS smtp_secure text NOT NULL DEFAULT 'ssl',
  ADD COLUMN IF NOT EXISTS smtp_username text,
  ADD COLUMN IF NOT EXISTS smtp_reply_to text,
  ADD COLUMN IF NOT EXISTS email_subject_template text NOT NULL DEFAULT 'Ihre Preisorientierung von {firma}';

-- Separate table to keep SMTP password isolated and never selectable by client
CREATE TABLE IF NOT EXISTS public.user_smtp_credentials (
  user_id uuid PRIMARY KEY,
  password_encrypted text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_smtp_credentials ENABLE ROW LEVEL SECURITY;

-- No SELECT / INSERT / UPDATE / DELETE policies for normal users.
-- Only the service role (edge functions) can read/write the password.
-- Service role bypasses RLS automatically.
