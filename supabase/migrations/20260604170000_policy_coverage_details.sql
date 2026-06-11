ALTER TABLE public.crm_policies
  ADD COLUMN IF NOT EXISTS coverage_details jsonb NOT NULL DEFAULT '{}'::jsonb;
