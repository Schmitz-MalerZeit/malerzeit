-- Clean up old Paddle sandbox data (Paddle was never live, so no live data exists)
DELETE FROM public.pdf_addons WHERE environment = 'sandbox';
DELETE FROM public.subscriptions WHERE environment = 'sandbox';
DELETE FROM public.affiliates;

-- Rename columns: subscriptions
ALTER TABLE public.subscriptions RENAME COLUMN paddle_customer_id TO stripe_customer_id;
ALTER TABLE public.subscriptions RENAME COLUMN paddle_subscription_id TO stripe_subscription_id;

-- Rename columns: pdf_addons
ALTER TABLE public.pdf_addons RENAME COLUMN paddle_transaction_id TO stripe_session_id;

-- Rename columns: affiliates
ALTER TABLE public.affiliates RENAME COLUMN paddle_discount_id TO stripe_promotion_code_id;

-- Ensure environment default exists on affiliates (was missing)
ALTER TABLE public.affiliates ALTER COLUMN environment SET DEFAULT 'sandbox';