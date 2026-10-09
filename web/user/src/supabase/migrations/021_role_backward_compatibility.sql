-- =============================================================================
-- MIGRATION 021: Role Backward Compatibility
-- Description: Syncs the new user_roles data back to the legacy 'role' column
--              in user_profiles to maintain compatibility with older app versions.
-- =============================================================================

-- 1. Initial Sync: Populate legacy columns based on the new multi-role table
-- Superadmins first (highest priority)
UPDATE public.user_profiles
SET role = 'superadmin', role_status = 'approved'
WHERE id IN (
  SELECT user_id FROM public.user_roles
  WHERE role = 'superadmin' AND status = 'approved'
);

-- Admins next
UPDATE public.user_profiles
SET role = 'admin', role_status = 'approved'
WHERE id IN (
  SELECT user_id FROM public.user_roles
  WHERE role = 'admin' AND status = 'approved'
)
AND (role IS NULL OR role = 'user');

-- 2. Maintenance Trigger: Keep legacy 'role' column in sync automatically
-- This function fires whenever a change occurs in user_roles and mirrors
-- the primary role back to the user_profiles table.
CREATE OR REPLACE FUNCTION public.sync_user_role_backward()
RETURNS TRIGGER AS $$
BEGIN
  -- We only mirror if the change is 'approved' or if it's a demotion to 'user'
  -- This ensures the old app's UI state matches the new permission state.
  UPDATE public.user_profiles
  SET role = NEW.role,
      role_status = NEW.status
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach the trigger
DROP TRIGGER IF EXISTS trg_sync_role_backward ON public.user_roles;
CREATE TRIGGER trg_sync_role_backward
AFTER INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.sync_user_role_backward();
