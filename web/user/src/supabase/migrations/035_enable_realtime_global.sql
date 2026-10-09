-- Migration 035: Enable Realtime for Core Business Tables
-- Description: Ensures locations, pricing, and court data are broadcasted for instant sync.

DO $$
BEGIN
    -- Enable for locations
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'locations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE locations;
    END IF;

    -- Enable for box_pricing
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'box_pricing'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE box_pricing;
    END IF;

    -- Enable for courts
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'courts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE courts;
    END IF;

    -- Enable for user_profiles (to sync role/status changes)
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'user_profiles'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE user_profiles;
    END IF;
END $$;
