-- Migration 015: Add sport column to challenges for better filtering and pagination
-- Description: Adds sport column to challenges table and creates indexes for performance.

-- 1. Add the sport column to the challenges table
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS sport TEXT;

-- 2. Add indexes for faster filtering and pagination
CREATE INDEX IF NOT EXISTS idx_challenges_sport ON public.challenges (sport);
CREATE INDEX IF NOT EXISTS idx_bookings_sport ON public.bookings (sport);

-- 3. Update existing challenges to a default sport so they remain visible
UPDATE public.challenges SET sport = 'Box Cricket' WHERE sport IS NULL;
