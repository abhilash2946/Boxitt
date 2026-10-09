-- Migration 060: Enable Realtime Publication for ALL Database Tables
-- Description: Ensures Supabase Realtime engine broadcasts INSERT/UPDATE/DELETE events
-- for every single table in the public schema across booking, challenge, payment,
-- matchmaking, chat, messaging, friendships, reviews, schedules, and game zone domains.

DO $$
BEGIN
    -- Ensure publication exists
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- Enable REPLICA IDENTITY FULL on all tables
ALTER TABLE IF EXISTS public.bookings REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.payments REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.challenges REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.matches REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.match_results REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.join_requests REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.courts REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.locations REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.box_pricing REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.box_schedules REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.notifications REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.user_profiles REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.user_roles REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.admin_accounts REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.closures REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.box_closures REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.ratings REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.reviews REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.friendships REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.chat_rooms REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.chat_room_members REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.game_zones REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.game_zone_platforms REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.game_zone_resources REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.game_zone_games REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.game_zone_resource_games REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.game_zone_blockouts REPLICA IDENTITY FULL;

-- Add all tables to supabase_realtime publication
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'bookings', 'payments', 'challenges', 'matches', 'match_results', 'join_requests',
        'courts', 'locations', 'box_pricing', 'box_schedules', 'notifications', 'user_profiles',
        'user_roles', 'admin_accounts', 'closures', 'box_closures', 'ratings', 'reviews',
        'friendships', 'chat_rooms', 'chat_room_members', 'chat_messages', 'game_zones',
        'game_zone_platforms', 'game_zone_resources', 'game_zone_games',
        'game_zone_resource_games', 'game_zone_blockouts'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        BEGIN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
        EXCEPTION
            WHEN duplicate_object THEN NULL;
            WHEN undefined_table THEN NULL;
        END;
    END LOOP;
END $$;
