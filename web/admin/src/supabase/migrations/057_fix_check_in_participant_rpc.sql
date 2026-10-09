-- =============================================================================
-- MIGRATION 057: Fix check_in_participant RPC Function
-- Description: Ensures check_in_participant automatically detects challenge, booking,
--              or join_requests records and sets explicit checked_in flags and confirmed status.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_in_participant(
    p_item_id TEXT,
    p_role TEXT DEFAULT NULL,
    p_user_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_caller_id UUID;
    v_role_lower TEXT := LOWER(TRIM(COALESCE(p_role, '')));
    v_user_uuid UUID := NULL;
    v_challenge RECORD;
    v_booking RECORD;
    v_join_req RECORD;
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

    IF p_user_id IS NOT NULL AND p_user_id <> '' AND p_user_id ~ '^[0-9a-fA-F-]{36}$' THEN
        v_user_uuid := p_user_id::UUID;
    END IF;

    -- 1. Try checking in as a CHALLENGE (by challenge.id or challenge.booking_id)
    SELECT * INTO v_challenge
    FROM public.challenges
    WHERE (id::TEXT = p_item_id) OR (booking_id::TEXT = p_item_id)
    LIMIT 1;

    IF v_challenge.id IS NOT NULL THEN
        -- Determine if target user is challenger or acceptor
        IF v_user_uuid IS NOT NULL AND v_challenge.challenger_id = v_user_uuid THEN
            UPDATE public.challenges SET challenger_checked_in = TRUE, updated_at = NOW() WHERE id = v_challenge.id;
            SELECT display_name INTO v_checked_in_name FROM public.user_profiles WHERE id = v_challenge.challenger_id;
        ELSIF v_user_uuid IS NOT NULL AND v_challenge.accepted_by = v_user_uuid THEN
            UPDATE public.challenges SET acceptor_checked_in = TRUE, updated_at = NOW() WHERE id = v_challenge.id;
            SELECT display_name INTO v_checked_in_name FROM public.user_profiles WHERE id = v_challenge.accepted_by;
        ELSIF v_role_lower IN ('host', 'challenger') THEN
            UPDATE public.challenges SET challenger_checked_in = TRUE, updated_at = NOW() WHERE id = v_challenge.id;
            SELECT display_name INTO v_checked_in_name FROM public.user_profiles WHERE id = v_challenge.challenger_id;
        ELSIF v_role_lower IN ('acceptor', 'challengee') THEN
            UPDATE public.challenges SET acceptor_checked_in = TRUE, updated_at = NOW() WHERE id = v_challenge.id;
            IF v_challenge.accepted_by IS NOT NULL THEN
                SELECT display_name INTO v_checked_in_name FROM public.user_profiles WHERE id = v_challenge.accepted_by;
            END IF;
        ELSE
            -- Default fallback: check in challenger if not checked in, else acceptor
            IF v_challenge.challenger_checked_in IS NOT TRUE THEN
                UPDATE public.challenges SET challenger_checked_in = TRUE, updated_at = NOW() WHERE id = v_challenge.id;
                SELECT display_name INTO v_checked_in_name FROM public.user_profiles WHERE id = v_challenge.challenger_id;
            ELSE
                UPDATE public.challenges SET acceptor_checked_in = TRUE, updated_at = NOW() WHERE id = v_challenge.id;
                IF v_challenge.accepted_by IS NOT NULL THEN
                    SELECT display_name INTO v_checked_in_name FROM public.user_profiles WHERE id = v_challenge.accepted_by;
                END IF;
            END IF;
        END IF;

        -- Re-fetch updated challenge
        SELECT * INTO v_challenge FROM public.challenges WHERE id = v_challenge.id;
        IF v_challenge.challenger_checked_in = TRUE AND (v_challenge.acceptor_checked_in = TRUE OR v_challenge.accepted_by IS NULL) THEN
            UPDATE public.challenges SET status = 'confirmed' WHERE id = v_challenge.id;
        END IF;

        -- Also update linked booking if present
        IF v_challenge.booking_id IS NOT NULL THEN
            UPDATE public.bookings SET checked_in = TRUE, host_checked_in = TRUE, status = 'confirmed' WHERE id = v_challenge.booking_id::TEXT;
        END IF;

        RETURN jsonb_build_object(
            'success', TRUE,
            'item_id', p_item_id,
            'role', p_role,
            'player_name', COALESCE(v_checked_in_name, 'Player'),
            'challenger_checked_in', v_challenge.challenger_checked_in,
            'acceptor_checked_in', v_challenge.acceptor_checked_in
        );
    END IF;

    -- 2. Try checking in as a BOOKING (by booking.id)
    SELECT * INTO v_booking FROM public.bookings WHERE id = p_item_id::TEXT LIMIT 1;
    IF v_booking.id IS NOT NULL THEN
        UPDATE public.bookings SET checked_in = TRUE, host_checked_in = TRUE, status = 'confirmed', updated_at = NOW() WHERE id = p_item_id::TEXT;
        v_checked_in_name := v_booking.name;

        RETURN jsonb_build_object(
            'success', TRUE,
            'item_id', p_item_id,
            'role', p_role,
            'player_name', COALESCE(v_checked_in_name, 'Host'),
            'host_checked_in', TRUE,
            'checked_in', TRUE
        );
    END IF;

    -- 3. Try checking in as a JOIN_REQUEST
    SELECT * INTO v_join_req FROM public.join_requests WHERE id::TEXT = p_item_id OR booking_id = p_item_id::TEXT LIMIT 1;
    IF v_join_req.id IS NOT NULL THEN
        UPDATE public.join_requests SET checked_in = TRUE WHERE id = v_join_req.id;
        v_checked_in_name := v_join_req.player_name;

        RETURN jsonb_build_object(
            'success', TRUE,
            'item_id', p_item_id,
            'role', p_role,
            'player_name', COALESCE(v_checked_in_name, 'Participant'),
            'checked_in', TRUE
        );
    END IF;

    RAISE EXCEPTION 'Ticket or booking ID not found: %', p_item_id;
END;
$$;
