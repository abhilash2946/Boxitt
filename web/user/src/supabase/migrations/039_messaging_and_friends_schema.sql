-- 039_messaging_and_friends_schema.sql
-- In-App Messaging, Friendship Network, and 24h Auto-Purge Migration

-- 1. Create Friendships Table
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id_1 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_id_2 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_friendship UNIQUE (user_id_1, user_id_2)
);

-- 2. Create Chat Rooms Table
CREATE TABLE IF NOT EXISTS public.chat_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('temporary_match', 'permanent_direct', 'permanent_group')),
    match_id UUID,
    name TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    format_capacity INT DEFAULT 10,
    is_readonly BOOLEAN DEFAULT FALSE,
    match_end_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create Chat Room Members Table
CREATE TABLE IF NOT EXISTS public.chat_room_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    joined_via TEXT DEFAULT 'invite',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_room_member UNIQUE (room_id, user_id)
);

-- 4. Drop legacy chat_messages table if it uses old schema (team_id) to ensure correct columns
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'chat_messages' AND column_name = 'team_id'
    ) THEN
        DROP TABLE public.chat_messages CASCADE;
    END IF;
END $$;

-- Recreate Chat Messages Table with correct columns
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    message_type TEXT DEFAULT 'text',
    content TEXT,
    payload_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Drop Existing Policies to Prevent Conflicts
DROP POLICY IF EXISTS "Users can view their friendships" ON public.friendships;
DROP POLICY IF EXISTS "Users can manage their friendships" ON public.friendships;
DROP POLICY IF EXISTS "Room members can view rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Authenticated users can create chat rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Anyone authenticated can view chat rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Anyone authenticated can create chat rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Anyone can view chat rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Anyone can create chat rooms" ON public.chat_rooms;

DROP POLICY IF EXISTS "Room members can view members" ON public.chat_room_members;
DROP POLICY IF EXISTS "Users can insert room members" ON public.chat_room_members;
DROP POLICY IF EXISTS "Admins can manage room members" ON public.chat_room_members;
DROP POLICY IF EXISTS "Anyone authenticated can view room members" ON public.chat_room_members;
DROP POLICY IF EXISTS "Anyone authenticated can insert room members" ON public.chat_room_members;
DROP POLICY IF EXISTS "Anyone authenticated can manage room members" ON public.chat_room_members;
DROP POLICY IF EXISTS "Anyone can view room members" ON public.chat_room_members;
DROP POLICY IF EXISTS "Anyone can insert room members" ON public.chat_room_members;
DROP POLICY IF EXISTS "Anyone can manage room members" ON public.chat_room_members;

DROP POLICY IF EXISTS "Room members can view messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Room members can insert messages if not readonly" ON public.chat_messages;
DROP POLICY IF EXISTS "Anyone authenticated can view chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Anyone authenticated can insert chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Anyone can view chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Anyone can insert chat messages" ON public.chat_messages;

-- RLS Policies
CREATE POLICY "Anyone can view friendships" ON public.friendships
    FOR SELECT USING (true);

CREATE POLICY "Anyone can manage friendships" ON public.friendships
    FOR ALL USING (true);

-- Chat Rooms Policies
CREATE POLICY "Anyone can manage chat rooms" ON public.chat_rooms
    FOR ALL USING (true);

-- Chat Room Members Policies
CREATE POLICY "Anyone can manage room members" ON public.chat_room_members
    FOR ALL USING (true);

-- Chat Messages Policies
CREATE POLICY "Anyone can manage chat messages" ON public.chat_messages
    FOR ALL USING (true);

-- Enable Realtime safely
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_room_members;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_rooms;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 5. Updated RPC for Expiry and Cleanup
CREATE OR REPLACE FUNCTION public.cleanup_expired_messaging()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Set temporary match rooms to READ-ONLY if 1 hour has passed since match_end_time
    UPDATE public.chat_rooms
    SET is_readonly = TRUE
    WHERE type = 'temporary_match'
      AND is_readonly = FALSE
      AND match_end_time IS NOT NULL
      AND match_end_time < (NOW() - INTERVAL '1 hour');

    -- Delete temporary match rooms older than 24 hours post match_end_time
    DELETE FROM public.chat_rooms
    WHERE type = 'temporary_match'
      AND match_end_time IS NOT NULL
      AND match_end_time < (NOW() - INTERVAL '24 hours');
END;
$$;
