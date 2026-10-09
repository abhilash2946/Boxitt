-- Migration: Add is_open to locations table
-- Description: Toggle to open or close the arena for bookings.

ALTER TABLE public.locations
ADD COLUMN IF NOT EXISTS is_open BOOLEAN DEFAULT true;

-- Ensure all existing locations have this set to true
UPDATE public.locations SET is_open = true WHERE is_open IS NULL;
