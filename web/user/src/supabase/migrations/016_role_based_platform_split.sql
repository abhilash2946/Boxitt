-- =============================================================================
-- MIGRATION 016: Role-Based Platform Split
-- Description: Updates user_profiles with role columns and re-configures location RLS.
-- =============================================================================

-- 1. Ensure role columns exist in user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user',
ADD COLUMN IF NOT EXISTS role_status TEXT DEFAULT 'approved',
ADD COLUMN IF NOT EXISTS requested_role TEXT;

-- Update existing users to have a default role if empty
UPDATE public.user_profiles SET role = 'user' WHERE role IS NULL;
UPDATE public.user_profiles SET role_status = 'approved' WHERE role_status IS NULL;

-- 2. Enable RLS on the locations table (redundant if already enabled but safe)
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies on locations to avoid "already exists" errors
DROP POLICY IF EXISTS "Public can view locations" ON public.locations;
DROP POLICY IF EXISTS "Admins can manage locations" ON public.locations;
DROP POLICY IF EXISTS "Users can view locations" ON public.locations;

-- 4. Create new role-aware policies for locations
-- Everyone (authenticated) can view locations
CREATE POLICY "Users can view locations"
ON public.locations
FOR SELECT
TO authenticated
USING (true);

-- Only approved Admins or SuperAdmins can manage (Insert/Update/Delete) locations
CREATE POLICY "Admins can manage locations"
ON public.locations
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin')
    AND role_status = 'approved'
  )
);
