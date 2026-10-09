-- =============================================================================
-- MIGRATION 062: Clean Up Match Score Formatting
-- Description: Ensures score_a and score_b remain clean numeric strings (like '1' and '0')
--              rather than long text summaries.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_match_status_on_result()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.matches
    SET status = 'finished',
        score_a = CASE
            WHEN score_a IS NULL OR score_a = '0' OR score_a LIKE '%vs%' OR score_a LIKE '%VS%' THEN '1'
            ELSE score_a
        END,
        score_b = CASE
            WHEN score_b IS NULL OR score_b = '0' THEN '0'
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

-- Clean up any existing long summary strings stored in score_a
UPDATE public.matches
SET score_a = '1',
    score_b = '0'
WHERE score_a LIKE '%vs%' OR score_a LIKE '%VS%';
