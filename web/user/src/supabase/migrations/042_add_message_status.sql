-- 042_add_message_status.sql
-- Add status column to chat_messages table to persist message delivery and read status permanently in Supabase DB

ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent';

-- Update RLS policy to allow updating chat_messages status
DROP POLICY IF EXISTS "Anyone can update chat messages" ON public.chat_messages;
CREATE POLICY "Anyone can update chat messages" ON public.chat_messages
    FOR UPDATE USING (true);
