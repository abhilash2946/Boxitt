-- =============================================================================
-- MIGRATION 003: Storage Config
-- Description: Bucket creation and storage-level RLS based on live reference.
-- =============================================================================

-- Ensure storage schema exists
CREATE SCHEMA IF NOT EXISTS storage;

-- =============================================================================
-- BUCKETS: Creation
-- =============================================================================

-- Bucket: arenas (For sports arena/location images)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('arenas', 'arenas', true, 10485760, '{image/*}')
ON CONFLICT (id) DO UPDATE SET 
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Bucket: profiles (For user profile media)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profiles', 'profiles', true, 5242880, '{image/*}')
ON CONFLICT (id) DO UPDATE SET 
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =============================================================================
-- POLICIES: Storage RLS
-- =============================================================================

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow public viewing of public buckets
CREATE POLICY "Public Access" ON storage.objects
    FOR SELECT USING (bucket_id IN ('arenas', 'profiles'));

-- Users can manage their own profile media
CREATE POLICY "Profile Media Management" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'profiles' AND (storage.foldername(name))[1] = auth.uid()::text)
    WITH CHECK (bucket_id = 'profiles' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Admins can manage arena imagery
CREATE POLICY "Arena Image Management" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'arenas' AND public.is_admin())
    WITH CHECK (bucket_id = 'arenas' AND public.is_admin());
