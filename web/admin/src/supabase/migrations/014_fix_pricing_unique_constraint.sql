-- =============================================================================
-- MIGRATION 014: Fix Pricing Unique Constraint
-- Description: Ensures box_pricing has a unique constraint that includes court_id.
-- =============================================================================

-- 1. Drop existing problematic constraints if they exist
ALTER TABLE public.box_pricing DROP CONSTRAINT IF EXISTS box_pricing_location_id_duration_hours_key;
ALTER TABLE public.box_pricing DROP CONSTRAINT IF EXISTS box_pricing_complex_key;
ALTER TABLE public.box_pricing DROP CONSTRAINT IF EXISTS box_pricing_advanced_unique;

-- 2. Ensure all columns exist
ALTER TABLE public.box_pricing ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.box_pricing ADD COLUMN IF NOT EXISTS rule_type TEXT DEFAULT 'default';
ALTER TABLE public.box_pricing ADD COLUMN IF NOT EXISTS day_of_week INTEGER;
ALTER TABLE public.box_pricing ADD COLUMN IF NOT EXISTS specific_date TEXT;
ALTER TABLE public.box_pricing ADD COLUMN IF NOT EXISTS court_id UUID REFERENCES public.courts(id) ON DELETE CASCADE;

-- 3. Add the new comprehensive unique constraint
-- We use NULLS NOT DISTINCT (requires PostgreSQL 15+) so that multiple NULLs are treated as duplicates.
ALTER TABLE public.box_pricing
ADD CONSTRAINT box_pricing_advanced_unique
UNIQUE NULLS NOT DISTINCT (
    location_id,
    court_id,
    duration_hours,
    category,
    rule_type,
    day_of_week,
    specific_date
);

-- 4. Re-verify RLS
ALTER TABLE public.box_pricing ENABLE ROW LEVEL SECURITY;
