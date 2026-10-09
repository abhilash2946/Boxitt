-- Migration 031: Auto-cleanup finished matches after 24 hours
-- Description: Adds a trigger to automatically purge matches and results that are older than 24 hours.

CREATE OR REPLACE FUNCTION public.trg_func_cleanup_old_matches()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete 'finished' or 'abandoned' matches older than 24 hours
    DELETE FROM public.matches
    WHERE status IN ('finished', 'abandoned')
      AND updated_at < (now() - interval '24 hours');

    -- Also cleanup match results (duplicate safety with migration 023)
    DELETE FROM public.match_results
    WHERE created_at < (now() - interval '24 hours');

    RETURN NULL; -- AFTER trigger can return NULL
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on matches: Clean up every time a match is updated (e.g., when one finishes)
DROP TRIGGER IF EXISTS trg_cleanup_matches ON public.matches;
CREATE TRIGGER trg_cleanup_matches
    AFTER UPDATE ON public.matches
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.trg_func_cleanup_old_matches();

-- Trigger on match_results: Clean up whenever a new result is posted
DROP TRIGGER IF EXISTS trg_cleanup_matches_on_result ON public.match_results;
CREATE TRIGGER trg_cleanup_matches_on_result
    AFTER INSERT ON public.match_results
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.trg_func_cleanup_old_matches();
