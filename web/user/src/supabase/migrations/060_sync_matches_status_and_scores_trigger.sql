-- =============================================================================
-- MIGRATION 060: Sync Match Status and Backfill Scores on Result Insert
-- Description: Ensures that whenever a row is inserted into public.match_results,
--              the corresponding row in public.matches is automatically marked as
--              'finished' and updated.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_match_status_on_result()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.matches
    SET status = 'finished',
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

-- Backfill matches status for any existing recorded match results
UPDATE public.matches m
SET status = 'finished',
    updated_at = NOW()
FROM public.match_results mr
WHERE m.challenge_id = mr.challenge_id OR m.id = mr.challenge_id;
