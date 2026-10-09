-- =============================================================================
-- MIGRATION 049: Fix Storage Buckets & Storage RLS Policies
-- Description: Ensures storage buckets (arenas, locations, courts, profiles) exist
-- and grants public/authenticated permission for uploading and managing media.
-- Prevents "StorageApiError: new row violates row-level security policy"
-- =============================================================================

-- 1. ENSURE BUCKETS EXIST
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('arenas', 'arenas', true, 10485760, '{image/*}'),
    ('locations', 'locations', true, 10485760, '{image/*}'),
    ('courts', 'courts', true, 10485760, '{image/*}'),
    ('profiles', 'profiles', true, 10485760, '{image/*}')
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. DROP CONFLICTING POLICIES
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Insert Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete Access" ON storage.objects;
DROP POLICY IF EXISTS "Storage Public All" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Profile Media Management" ON storage.objects;
DROP POLICY IF EXISTS "Arena Image Management" ON storage.objects;

-- 3. CREATE PERMISSIVE STORAGE POLICIES
CREATE POLICY "Public Read Access" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id IN ('arenas', 'locations', 'courts', 'profiles'));

CREATE POLICY "Public Insert Access" ON storage.objects
    FOR INSERT TO public
    WITH CHECK (bucket_id IN ('arenas', 'locations', 'courts', 'profiles'));

CREATE POLICY "Public Update Access" ON storage.objects
    FOR UPDATE TO public
    USING (bucket_id IN ('arenas', 'locations', 'courts', 'profiles'))
    WITH CHECK (bucket_id IN ('arenas', 'locations', 'courts', 'profiles'));

CREATE POLICY "Public Delete Access" ON storage.objects
    FOR DELETE TO public
    USING (bucket_id IN ('arenas', 'locations', 'courts', 'profiles'));
