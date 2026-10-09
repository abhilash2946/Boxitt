-- Migration: Create 'courts' bucket and set up storage policies

-- 1. Create the 'courts' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('courts', 'courts', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow Public Access (SELECT)
-- We use DO $$ BEGIN ... END $$; to safely create policies without errors if they already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'objects' AND policyname = 'Public Access for courts'
    ) THEN
        CREATE POLICY "Public Access for courts" ON storage.objects
          FOR SELECT USING (bucket_id = 'courts');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'objects' AND policyname = 'Admin Upload for courts'
    ) THEN
        CREATE POLICY "Admin Upload for courts" ON storage.objects
          FOR INSERT WITH CHECK (bucket_id = 'courts');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'objects' AND policyname = 'Admin Update for courts'
    ) THEN
        CREATE POLICY "Admin Update for courts" ON storage.objects
          FOR UPDATE WITH CHECK (bucket_id = 'courts');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'objects' AND policyname = 'Admin Delete for courts'
    ) THEN
        CREATE POLICY "Admin Delete for courts" ON storage.objects
          FOR DELETE USING (bucket_id = 'courts');
    END IF;
END
$$;
