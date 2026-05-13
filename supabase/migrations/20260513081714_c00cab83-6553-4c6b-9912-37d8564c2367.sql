ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS estimated_labor_cost numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS material_cost numeric NOT NULL DEFAULT 0;