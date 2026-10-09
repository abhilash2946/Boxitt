-- Migration 033: Fix Matchmaking Visibility and Cleanup Logic
-- Description: Ensures finished matches stay visible until paid, and only delete 1 hour after payment.

-- 1. Update the Challenges table trigger to handle auto_delete_at correctly
CREATE OR REPLACE FUNCTION public.update_challenge_auto_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- If match is confirmed but NOT finished, keep auto_delete_at far in the future or NULL
    -- If match is finished AND settlement is completed, set auto_delete_at to 1 hour from now
    -- If match is finished but settlement is PENDING, keep it NULL (don't delete)

    IF NEW.status = 'confirmed' THEN
        -- Check if a result exists for this challenge
        IF EXISTS (SELECT 1 FROM public.match_results WHERE challenge_id = NEW.id) THEN
            IF NEW.settlement_status = 'completed' THEN
                -- Paid: Delete in 1 hour
                NEW.auto_delete_at := NOW() + interval '1 hour';
            ELSE
                -- Unpaid: Never auto-delete
                NEW.auto_delete_at := NULL;
            END IF;
        ELSE
            -- Match still upcoming/live: Keep for at least 24h or until finished
            NEW.auto_delete_at := GREATEST(COALESCE(NEW.auto_delete_at, NOW()), NOW() + interval '24 hours');
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Update the cleanup function to be safer
CREATE OR REPLACE FUNCTION public.cleanup_expired_matchmaking()
RETURNS integer AS $$
DECLARE
  removed INTEGER := 0;
  c1 INTEGER := 0;
  c3 INTEGER := 0;
BEGIN
  -- 1. Delete expired notifications
  DELETE FROM notifications
  WHERE auto_delete_at IS NOT NULL
    AND auto_delete_at <= NOW();
  GET DIAGNOSTICS c3 = ROW_COUNT;

  -- 2. Delete expired challenges
  -- ONLY delete if auto_delete_at is reached
  -- and status is NOT confirmed OR (confirmed AND settlement_status = 'completed')
  DELETE FROM challenges
  WHERE auto_delete_at IS NOT NULL
    AND auto_delete_at <= NOW()
    AND (
        status <> 'confirmed'
        OR (status = 'confirmed' AND settlement_status = 'completed')
    );
  GET DIAGNOSTICS c1 = ROW_COUNT;

  removed := c1 + c3;
  RETURN removed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Add a trigger to update auto_delete_at whenever settlement or results change
DROP TRIGGER IF EXISTS trg_update_challenge_visibility ON public.challenges;
CREATE TRIGGER trg_update_challenge_visibility
    BEFORE UPDATE ON public.challenges
    FOR EACH ROW
    EXECUTE FUNCTION public.update_challenge_auto_delete();
