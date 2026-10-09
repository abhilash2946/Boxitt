-- =============================================================================
-- MIGRATION 010: Storage RLS Fix for SuperAdmins
-- Description: Ensures SuperAdmins have full access to manage all buckets.
-- =============================================================================

-- Ensure is_superadmin logic is reliable for Storage RLS
-- (Storage policies can be strict about schema access)

-- 1. Explicitly allow superadmins to manage all objects in 'arenas' bucket
DROP POLICY IF EXISTS "Superadmin Arena Management" ON storage.objects;
CREATE POLICY "Superadmin Arena Management" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'arenas' AND (public.is_superadmin() OR public.is_admin()))
    WITH CHECK (bucket_id = 'arenas' AND (public.is_superadmin() OR public.is_admin()));

-- 2. Explicitly allow superadmins to manage all objects in 'profiles' bucket
DROP POLICY IF EXISTS "Superadmin Profile Management" ON storage.objects;
CREATE POLICY "Superadmin Profile Management" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'profiles' AND (public.is_superadmin() OR public.is_admin()))
    WITH CHECK (bucket_id = 'profiles' AND (public.is_superadmin() OR public.is_admin()));

-- 3. Maintain existing Admin policy but as a fallback (Removing redundant policy to avoid confusion)
DROP POLICY IF EXISTS "Arena Image Management" ON storage.objects;
