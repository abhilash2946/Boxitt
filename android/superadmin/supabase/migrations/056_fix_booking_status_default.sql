-- =============================================================================
-- MIGRATION 056: Fix Default Booking Status & Reset Unscanned Bookings
-- Description: Ensures bookings default to 'booked' upon payment and only become
--              'confirmed' when scanned by an admin at the arena.
-- =============================================================================

-- 1. Ensure default status on bookings table is 'booked'
ALTER TABLE public.bookings ALTER COLUMN status SET DEFAULT 'booked';

-- 2. Reset unscanned bookings from 'confirmed' to 'booked'
UPDATE public.bookings
SET status = 'booked'
WHERE status = 'confirmed'
  AND (checked_in IS NOT TRUE AND host_checked_in IS NOT TRUE);

-- 3. Reset unscanned challenges from 'confirmed' to 'booked'
UPDATE public.challenges
SET status = 'booked'
WHERE status = 'confirmed'
  AND (challenger_checked_in IS NOT TRUE AND acceptor_checked_in IS NOT TRUE);
