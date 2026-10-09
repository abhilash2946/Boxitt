-- =============================================================================
-- MIGRATION 019: Link Admin Accounts to Supabase Users
-- Description: Adds a user_id to admin_accounts and updates RLS for better integration.
-- =============================================================================

-- 1. Add user_id column to admin_accounts
ALTER TABLE public.admin_accounts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Create index for performance
CREATE INDEX IF NOT EXISTS idx_admin_accounts_user_id ON public.admin_accounts(user_id);

-- 3. Create a helper function to check if a user is an admin for a specific location
CREATE OR REPLACE FUNCTION public.check_is_admin_of_location(loc_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Superadmins have access to everything
  IF public.check_is_superadmin() THEN
    RETURN TRUE;
  END IF;

  -- Check if user has 'admin' role and is linked to this location
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.admin_accounts aa ON ur.user_id = aa.user_id
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'
    AND ur.status = 'approved'
    AND aa.location_id = loc_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update RLS policies for locations (SuperAdmin or Linked Admin)
DROP POLICY IF EXISTS "Admins can update their own location" ON public.locations;
CREATE POLICY "Admins can update their own location"
ON public.locations FOR UPDATE
TO authenticated
USING (public.check_is_admin_of_location(id));

-- 5. Update RLS policies for bookings (Admins of the location)
DROP POLICY IF EXISTS "Admins can manage bookings of their location" ON public.bookings;
CREATE POLICY "Admins can manage bookings of their location"
ON public.bookings FOR ALL
TO authenticated
USING (public.check_is_admin_of_location(location_id));

-- 6. Update RLS for box_pricing
DROP POLICY IF EXISTS "Admins can manage pricing of their location" ON public.box_pricing;
CREATE POLICY "Admins can manage pricing of their location"
ON public.box_pricing FOR ALL
TO authenticated
USING (public.check_is_admin_of_location(location_id));

-- 7. Update RLS for courts
DROP POLICY IF EXISTS "Admins can manage courts of their location" ON public.courts;
CREATE POLICY "Admins can manage courts of their location"
ON public.courts FOR ALL
TO authenticated
USING (public.check_is_admin_of_location(location_id));
