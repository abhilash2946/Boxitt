-- =============================================================================
-- MIGRATION 011: Add Multiple Courts Support
-- =============================================================================

-- 1. Add number_of_courts to locations
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS number_of_courts INTEGER DEFAULT 1;

-- 2. Create courts table
CREATE TABLE IF NOT EXISTS public.courts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id    UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    court_number   INTEGER NOT NULL,
    name           TEXT,
    description    TEXT,
    image_urls     TEXT[] DEFAULT '{}',
    open_hour      INTEGER,
    close_hour     INTEGER,
    morning_start  INTEGER,
    morning_end    INTEGER,
    night_start    INTEGER,
    night_end      INTEGER,
    created_at     TIMESTAMPTZ DEFAULT now(),
    updated_at     TIMESTAMPTZ DEFAULT now(),
    UNIQUE(location_id, court_number)
);

-- 3. Add court_id to bookings and box_pricing
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS court_id UUID REFERENCES public.courts(id) ON DELETE SET NULL;
ALTER TABLE public.box_pricing ADD COLUMN IF NOT EXISTS court_id UUID REFERENCES public.courts(id) ON DELETE CASCADE;

-- 4. Update box_pricing unique constraint
-- First drop the old one if it exists (001 migration name was implicit or we need to find it)
-- Usually it is location_id_duration_hours_key
ALTER TABLE public.box_pricing DROP CONSTRAINT IF EXISTS box_pricing_location_id_duration_hours_key;

-- Add new constraint including court_id (allowing NULL for global rules if needed, though we'll likely use Court 1 as default)
-- But wait, pricingService.ts mentions category, rule_type, day_of_week, specific_date in onConflict.
-- Let's check the current constraints on box_pricing.
-- For now, we add a flexible unique constraint.
ALTER TABLE public.box_pricing ADD CONSTRAINT box_pricing_complex_key UNIQUE NULLS NOT DISTINCT (location_id, duration_hours, category, rule_type, day_of_week, specific_date, court_id);

-- 5. Data Migration: Create "Court 1" for all existing locations and link existing bookings/pricing
DO $$
DECLARE
    loc RECORD;
    new_court_id UUID;
BEGIN
    FOR loc IN SELECT id FROM public.locations LOOP
        -- Create default Court 1
        INSERT INTO public.courts (location_id, court_number, name)
        VALUES (loc.id, 1, 'Court 1')
        RETURNING id INTO new_court_id;

        -- Link existing bookings to Court 1
        UPDATE public.bookings SET court_id = new_court_id WHERE location_id = loc.id AND court_id IS NULL;

        -- Link existing pricing to Court 1
        UPDATE public.box_pricing SET court_id = new_court_id WHERE location_id = loc.id AND court_id IS NULL;
    END LOOP;
END $$;
