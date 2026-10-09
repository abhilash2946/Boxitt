-- =============================================================================
-- MIGRATION 017: Multi-Role Architecture
-- Description: Moves roles to a separate table to allow dynamic role switching per platform.
-- =============================================================================

-- 1. Create the user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'admin', 'superadmin')),
    status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, role)
);

-- 2. Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Create a non-recursive check function
CREATE OR REPLACE FUNCTION public.check_is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'superadmin'
    AND status = 'approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RLS Policies for user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own roles" ON public.user_roles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Superadmins can manage all roles" ON public.user_roles FOR ALL TO authenticated USING (public.check_is_superadmin());

-- 4. Initial Data Migration: Move roles from user_profiles to user_roles
DO $$
BEGIN
    -- For every profile, create a 'user' role entry
    INSERT INTO public.user_roles (user_id, role, status)
    SELECT id, 'user', 'approved'
    FROM public.user_profiles
    ON CONFLICT (user_id, role) DO NOTHING;

    -- If they had 'admin' role in user_profiles, create an 'admin' role entry
    INSERT INTO public.user_roles (user_id, role, status)
    SELECT id, 'admin', 'approved'
    FROM public.user_profiles
    WHERE role = 'admin'
    ON CONFLICT (user_id, role) DO NOTHING;

    -- If they had 'superadmin' role in user_profiles, create a 'superadmin' role entry
    INSERT INTO public.user_roles (user_id, role, status)
    SELECT id, 'superadmin', 'approved'
    FROM public.user_profiles
    WHERE role = 'superadmin'
    ON CONFLICT (user_id, role) DO NOTHING;
END $$;

-- 5. Cleanup user_profiles (Optional: We keep columns for now to avoid breaking existing code immediately, but set them to null/default)
-- ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS role;
-- ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS role_status;
-- ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS requested_role;
