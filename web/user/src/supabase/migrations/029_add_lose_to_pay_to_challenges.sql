-- Migration 029: Add lose_to_pay toggle to challenges
-- Description: Allows challenge hosts to determine whether the loser pays the balance or the creator pays.

ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS lose_to_pay BOOLEAN DEFAULT TRUE;
