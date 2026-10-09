-- =============================================================================
-- MIGRATION 044: Add Max Capacity to Locations and Courts
-- =============================================================================

ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS max_capacity INTEGER DEFAULT 50;
ALTER TABLE public.courts ADD COLUMN IF NOT EXISTS max_capacity INTEGER DEFAULT 50;
