-- =============================================================================
-- MIGRATION 059: Fix match_results RLS Policies & Triggers
-- Description: Grants public (anon & authenticated) insert/select/update/delete
--              permissions on public.match_results so match score syncs succeed
--              from all scorer sessions (including guest/shared scorer links).
--              Also sets trigger functions to SECURITY DEFINER to avoid RLS failures
--              when updating linked challenges.
-- =============================================================================

-- 1. Ensure Table Permissions
GRANT ALL ON public.match_results TO anon, authenticated, service_role;

-- 2. Enable RLS
ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;

-- 3. Drop all legacy policies
DROP POLICY IF EXISTS "Users can view relevant match results" ON public.match_results;
DROP POLICY IF EXISTS "Authenticated users can insert results" ON public.match_results;
DROP POLICY IF EXISTS "match_results_select_policy" ON public.match_results;
DROP POLICY IF EXISTS "match_results_insert_policy" ON public.match_results;
DROP POLICY IF EXISTS "match_results_update_policy" ON public.match_results;
DROP POLICY IF EXISTS "match_results_delete_policy" ON public.match_results;

-- 4. Create explicit RLS policies for public access
CREATE POLICY "match_results_select_policy" ON public.match_results
    FOR SELECT TO public
    USING (true);

CREATE POLICY "match_results_insert_policy" ON public.match_results
    FOR INSERT TO public
    WITH CHECK (true);

CREATE POLICY "match_results_update_policy" ON public.match_results
    FOR UPDATE TO public
    USING (true)
    WITH CHECK (true);

CREATE POLICY "match_results_delete_policy" ON public.match_results
    FOR DELETE TO public
    USING (true);

-- 5. Harden Trigger Functions with SECURITY DEFINER
-- Function 1: Sync updated_at on challenges when a match result is recorded
CREATE OR REPLACE FUNCTION public.sync_challenge_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.challenges
    SET updated_at = NOW()
    WHERE id = NEW.challenge_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_challenge_update ON public.match_results;
CREATE TRIGGER trg_sync_challenge_update
    AFTER INSERT ON public.match_results
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_challenge_updated_at();

-- Function 2: Clean up old results
CREATE OR REPLACE FUNCTION public.cleanup_old_results_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.match_results WHERE created_at < now() - interval '24 hours';
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_match_results ON public.match_results;
CREATE TRIGGER trg_cleanup_match_results
    AFTER INSERT ON public.match_results
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.cleanup_old_results_trigger();
