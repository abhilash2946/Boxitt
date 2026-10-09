-- 041_add_chat_read_receipts.sql
-- Add last_read_at column to chat_room_members table to support WhatsApp-style real-time read receipts (double blue ticks)

ALTER TABLE public.chat_room_members
ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ DEFAULT NOW();
