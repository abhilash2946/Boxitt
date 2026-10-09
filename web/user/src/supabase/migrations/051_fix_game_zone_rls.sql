-- =============================================================================
-- MIGRATION 051: Fix Game Zone RLS Policies (Allow Admin Writes)
-- Description: Ensures game_zone_platforms, game_zone_resources, game_zone_games,
-- game_zone_resource_games, and game_zone_blockouts allow INSERT, UPDATE, DELETE
-- operations from the Admin/SuperAdmin dashboards.
-- Prevents "403 Forbidden / new row violates row-level security policy for table game_zone_platforms"
-- =============================================================================

ALTER TABLE public.game_zone_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_zone_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_zone_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_zone_resource_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_zone_blockouts ENABLE ROW LEVEL SECURITY;

-- Drop legacy write policies
DROP POLICY IF EXISTS "game_zone_platforms_admin_write_policy" ON public.game_zone_platforms;
DROP POLICY IF EXISTS "game_zone_resources_admin_write_policy" ON public.game_zone_resources;
DROP POLICY IF EXISTS "game_zone_games_admin_write_policy" ON public.game_zone_games;
DROP POLICY IF EXISTS "game_zone_resource_games_admin_write_policy" ON public.game_zone_resource_games;
DROP POLICY IF EXISTS "game_zone_blockouts_admin_write_policy" ON public.game_zone_blockouts;

DROP POLICY IF EXISTS "game_zone_platforms_write" ON public.game_zone_platforms;
DROP POLICY IF EXISTS "game_zone_resources_write" ON public.game_zone_resources;
DROP POLICY IF EXISTS "game_zone_games_write" ON public.game_zone_games;
DROP POLICY IF EXISTS "game_zone_resource_games_write" ON public.game_zone_resource_games;
DROP POLICY IF EXISTS "game_zone_blockouts_write" ON public.game_zone_blockouts;

-- Create permissive write policies
CREATE POLICY "game_zone_platforms_write" ON public.game_zone_platforms FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "game_zone_resources_write" ON public.game_zone_resources FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "game_zone_games_write" ON public.game_zone_games FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "game_zone_resource_games_write" ON public.game_zone_resource_games FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "game_zone_blockouts_write" ON public.game_zone_blockouts FOR ALL TO public USING (true) WITH CHECK (true);
