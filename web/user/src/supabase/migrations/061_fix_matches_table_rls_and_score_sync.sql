-- =============================================================================
-- MIGRATION 061: Fix matches Table RLS Policies & Score Synchronization
-- Description: Grants public (anon & authenticated) full permissions on public.matches,
--              replaces restrictive RLS policies with open public policies, and updates
--              the trigger function to sync score_a and score_b when match_results are inserted.
-- =============================================================================

-- 1. Table Permissions
GRANT ALL ON public.matches TO anon, authenticated, service_role;

-- 2. Enable RLS
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- 3. Drop legacy policies
DROP POLICY IF EXISTS "Public can view matches" ON public.matches;
DROP POLICY IF EXISTS "Authenticated users can manage matches" ON public.matches;
DROP POLICY IF EXISTS "matches_select_policy" ON public.matches;
DROP POLICY IF EXISTS "matches_insert_policy" ON public.matches;
DROP POLICY IF EXISTS "matches_update_policy" ON public.matches;
DROP POLICY IF EXISTS "matches_delete_policy" ON public.matches;

-- 4. Create public RLS policies
CREATE POLICY "matches_select_policy" ON public.matches
    FOR SELECT TO public
    USING (true);

CREATE POLICY "matches_insert_policy" ON public.matches
    FOR INSERT TO public
    WITH CHECK (true);

CREATE POLICY "matches_update_policy" ON public.matches
    FOR UPDATE TO public
    USING (true)
    WITH CHECK (true);

CREATE POLICY "matches_delete_policy" ON public.matches
    FOR DELETE TO public
    USING (true);

-- 5. Trigger Function to sync status and scores when match_results are inserted
CREATE OR REPLACE FUNCTION public.sync_match_status_on_result()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.matches
    SET status = 'finished',
        score_a = CASE
            WHEN score_a IS NULL OR score_a = '0' THEN COALESCE(NEW.score_summary, 'Finished')
            ELSE score_a
        END,
        score_b = CASE
            WHEN score_b IS NULL OR score_b = '0' THEN 'Finished'
            ELSE score_b
        END,
        updated_at = NOW()
    WHERE challenge_id = NEW.challenge_id
       OR id = NEW.challenge_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_match_status_on_result ON public.match_results;
CREATE TRIGGER trg_sync_match_status_on_result
    AFTER INSERT ON public.match_results
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_match_status_on_result();

-- Backfill matches status and score summary for existing match results
UPDATE public.matches m
SET status = 'finished',
    score_a = CASE WHEN m.score_a IS NULL OR m.score_a = '0' THEN COALESCE(mr.score_summary, 'Finished') ELSE m.score_a END,
    updated_at = NOW()
FROM public.match_results mr
WHERE m.challenge_id = mr.challenge_id OR m.id = mr.challenge_id;
