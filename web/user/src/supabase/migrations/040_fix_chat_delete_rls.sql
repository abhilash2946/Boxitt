-- 040_fix_chat_delete_rls.sql
-- Fix Row Level Security (RLS) policies for chat_rooms, chat_room_members, and chat_messages to allow DELETE

-- Chat Rooms
DROP POLICY IF EXISTS "Anyone can view chat rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Anyone can create chat rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Anyone can manage chat rooms" ON public.chat_rooms;

CREATE POLICY "Anyone can manage chat rooms" ON public.chat_rooms
    FOR ALL USING (true);

-- Chat Room Members
DROP POLICY IF EXISTS "Anyone can view room members" ON public.chat_room_members;
DROP POLICY IF EXISTS "Anyone can insert room members" ON public.chat_room_members;
DROP POLICY IF EXISTS "Anyone can manage room members" ON public.chat_room_members;

CREATE POLICY "Anyone can manage room members" ON public.chat_room_members
    FOR ALL USING (true);

-- Chat Messages
DROP POLICY IF EXISTS "Anyone can view chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Anyone can insert chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Anyone can manage chat messages" ON public.chat_messages;

CREATE POLICY "Anyone can manage chat messages" ON public.chat_messages
    FOR ALL USING (true);
