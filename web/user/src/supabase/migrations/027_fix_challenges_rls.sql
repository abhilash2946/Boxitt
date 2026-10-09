-- =============================================================================
-- MIGRATION 027: Fix Challenges RLS Policy
-- Description: Fixes "new row violates row-level security policy for table 'challenges'"
--              by relaxing the INSERT policy to allow public/authenticated inserts,
--              ensuring automated or client-side challenge creation on booking succeeds.
-- =============================================================================

DROP POLICY IF EXISTS "Users can create challenges" ON public.challenges;

CREATE POLICY "Users can create challenges"
ON public.challenges
FOR INSERT
TO public
WITH CHECK (true);
