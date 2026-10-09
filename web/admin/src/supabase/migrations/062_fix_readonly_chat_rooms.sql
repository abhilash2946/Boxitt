-- Migration 062: Fix Readonly Chat Rooms Status
-- Description: Unlocks chat rooms that were erroneously marked as is_readonly = true
-- due to overnight 12:00 AM date parsing logic.

UPDATE public.chat_rooms
SET is_readonly = FALSE
WHERE type = 'temporary_match'
  AND is_readonly = TRUE;
