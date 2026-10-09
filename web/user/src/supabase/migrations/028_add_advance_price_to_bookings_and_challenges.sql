-- Migration 028: Add advance_price to bookings and challenges
-- Description: Stores the specific advance price for a slot at the time of booking/challenge creation.

-- 1. Add advance_price to bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS advance_price NUMERIC(10, 2);

-- 2. Add advance_price to challenges
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS advance_price NUMERIC(10, 2);

-- 3. Update existing records if possible (optional, but good for consistency)
-- For existing records, we can fallback to location's default advance if needed,
-- but it's better to just leave them null or set to 0 and let the app handle fallbacks.
