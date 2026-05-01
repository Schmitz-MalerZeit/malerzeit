-- Remove duplicate unique constraint on pdf_usage(user_id, period_start).
-- Two identical constraints existed (pdf_usage_user_id_period_start_key + pdf_usage_user_period_unique),
-- which can confuse ON CONFLICT resolution and waste index space.
ALTER TABLE public.pdf_usage DROP CONSTRAINT IF EXISTS pdf_usage_user_period_unique;