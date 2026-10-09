-- =============================================================================
-- MIGRATION 052: Add Independent Timing Support to Game Zone Platforms
-- =============================================================================

ALTER TABLE public.game_zone_platforms ADD COLUMN IF NOT EXISTS open_hour INTEGER;
ALTER TABLE public.game_zone_platforms ADD COLUMN IF NOT EXISTS close_hour INTEGER;
ALTER TABLE public.game_zone_platforms ADD COLUMN IF NOT EXISTS morning_start INTEGER;
ALTER TABLE public.game_zone_platforms ADD COLUMN IF NOT EXISTS morning_end INTEGER;
ALTER TABLE public.game_zone_platforms ADD COLUMN IF NOT EXISTS night_start INTEGER;
ALTER TABLE public.game_zone_platforms ADD COLUMN IF NOT EXISTS night_end INTEGER;
