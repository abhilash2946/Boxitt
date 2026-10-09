-- =============================================================================
-- MIGRATION 055: Add Individual Participant Check-ins
-- Description: Adds individual check-in tracking for Challenger, Challengee, Match Host,
--              and Match Participants, along with a secure check_in_participant RPC function.
-- =============================================================================

-- 1. Add check-in columns to challenges table
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS challenger_checked_in BOOLEAN DEFAULT FALSE;
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS acceptor_checked_in BOOLEAN DEFAULT FALSE;

-- 2. Add check-in columns to bookings table
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS host_checked_in BOOLEAN DEFAULT FALSE;

-- 3. Add check-in column to join_requests table
ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS checked_in BOOLEAN DEFAULT FALSE;

-- 4. RPC function to perform individual check-in securely
CREATE OR REPLACE FUNCTION public.check_in_participant(
    p_item_id TEXT,
    p_role TEXT,
    p_user_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_caller_id UUID;
    v_role_lower TEXT := LOWER(TRIM(COALESCE(p_role, '')));
    v_challenge RECORD;
    v_booking RECORD;
    v_checked_in_name TEXT := 'Player';
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Verify caller is admin or superadmin
    IF NOT (is_admin() OR is_superadmin()) THEN
        RAISE EXCEPTION 'Only arena staff/admins can check in players';
    END IF;

    IF v_role_lower IN ('host', 'challenger', 'acceptor', 'challengee') THEN
        SELECT * INTO v_challenge FROM public.challenges WHERE id = p_item_id::UUID;
        IF v_challenge.id IS NULL THEN
            RAISE EXCEPTION 'Challenge record not found';
        END IF;

        IF v_role_lower IN ('host', 'challenger') THEN
            UPDATE public.challenges
            SET challenger_checked_in = TRUE,
                updated_at = NOW()
            WHERE id = p_item_id::UUID;

            SELECT display_name INTO v_checked_in_name FROM public.user_profiles WHERE id = v_challenge.challenger_id;
        ELSE
            UPDATE public.challenges
            SET acceptor_checked_in = TRUE,
                updated_at = NOW()
            WHERE id = p_item_id::UUID;

            IF v_challenge.accepted_by IS NOT NULL THEN
                SELECT display_name INTO v_checked_in_name FROM public.user_profiles WHERE id = v_challenge.accepted_by;
            END IF;
        END IF;

        -- Fetch updated state
        SELECT * INTO v_challenge FROM public.challenges WHERE id = p_item_id::UUID;
        IF v_challenge.challenger_checked_in = TRUE AND (v_challenge.acceptor_checked_in = TRUE OR v_challenge.accepted_by IS NULL) THEN
            UPDATE public.challenges SET status = 'confirmed' WHERE id = p_item_id::UUID;
        END IF;

        RETURN jsonb_build_object(
            'success', TRUE,
            'item_id', p_item_id,
            'role', p_role,
            'player_name', COALESCE(v_checked_in_name, 'Player'),
            'challenger_checked_in', v_challenge.challenger_checked_in,
            'acceptor_checked_in', v_challenge.acceptor_checked_in
        );

    ELSIF v_role_lower IN ('match_host', 'booking_host') THEN
        UPDATE public.bookings
        SET host_checked_in = TRUE,
            updated_at = NOW()
        WHERE id = p_item_id::TEXT;

        SELECT name INTO v_checked_in_name FROM public.bookings WHERE id = p_item_id::TEXT;

        RETURN jsonb_build_object(
            'success', TRUE,
            'item_id', p_item_id,
            'role', p_role,
            'player_name', COALESCE(v_checked_in_name, 'Host'),
            'host_checked_in', TRUE
        );

    ELSIF v_role_lower IN ('player', 'participant', 'match_participant', 'joinable') THEN
        IF p_user_id IS NOT NULL AND p_user_id <> '' THEN
            UPDATE public.join_requests
            SET checked_in = TRUE
            WHERE booking_id = p_item_id::TEXT
              AND requester_id = p_user_id::UUID;
        ELSE
            UPDATE public.join_requests
            SET checked_in = TRUE
            WHERE booking_id = p_item_id::TEXT;
        END IF;

        SELECT player_name INTO v_checked_in_name FROM public.join_requests
        WHERE booking_id = p_item_id::TEXT
          AND (p_user_id IS NULL OR p_user_id = '' OR requester_id = p_user_id::UUID)
        LIMIT 1;

        RETURN jsonb_build_object(
            'success', TRUE,
            'item_id', p_item_id,
            'role', p_role,
            'player_name', COALESCE(v_checked_in_name, 'Participant'),
            'checked_in', TRUE
        );

    ELSE
        RAISE EXCEPTION 'Unknown check-in role: %', p_role;
    END IF;
END;
$$;
