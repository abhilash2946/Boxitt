-- Migration 030: Enable Realtime for matches and match_results
-- Description: Ensures Supabase Realtime publication includes the match tracking tables.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'matches'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE matches;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'match_results'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE match_results;
    END IF;
END $$;
