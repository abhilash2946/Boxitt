-- =============================================================================
-- MIGRATION 018: Auto User Role Trigger
-- Description: Automatically assigns the 'user' role when a profile is created.
-- =============================================================================

-- Function to handle auto-assignment
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role, status)
  VALUES (NEW.id, 'user', 'approved')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to fire after profile insertion
DROP TRIGGER IF EXISTS on_profile_created_add_role ON public.user_profiles;
CREATE TRIGGER on_profile_created_add_role
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Backfill for any users created during the transition
INSERT INTO public.user_roles (user_id, role, status)
SELECT id, 'user', 'approved'
FROM public.user_profiles
ON CONFLICT (user_id, role) DO NOTHING;
