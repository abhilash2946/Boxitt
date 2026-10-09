-- Migration 024: Add missing columns to challenges table
-- Description: Adds box_id, coordinates, radius, players info, and amount. Also fixes booking_id type.

-- 1. Add missing columns
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS box_id UUID REFERENCES public.locations(id) ON DELETE CASCADE;
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS radius INTEGER DEFAULT 5;
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS max_players INTEGER DEFAULT 10;
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS current_players INTEGER DEFAULT 1;
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS amount NUMERIC(10, 2);

-- 2. Fix booking_id type (from UUID to TEXT to match bookings.id)
-- We need to drop the column and re-add it if we want to change the type,
-- or use USING if it's compatible. Since they are different formats, re-adding is safer if no data exists.
-- However, to be safe with existing data (if any), we use the USING clause.
ALTER TABLE public.challenges ALTER COLUMN booking_id TYPE TEXT USING booking_id::text;

-- 3. Add index for box_id
CREATE INDEX IF NOT EXISTS idx_challenges_box_id ON public.challenges (box_id);
