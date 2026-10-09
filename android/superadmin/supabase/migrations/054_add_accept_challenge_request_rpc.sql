-- =============================================================================
-- MIGRATION 054: Add accept_challenge_request RPC function
-- Description: Safely and atomically accepts a challenge request, updates challenge status,
--              and manages notifications with full parity across Web and Android.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.accept_challenge_request(
    p_challenge_id TEXT,
    p_requester_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_challenge RECORD;
    v_challenger_profile RECORD;
    v_requester_profile RECORD;
    v_box RECORD;
    v_is_advance BOOLEAN := FALSE;
    v_initial_status TEXT;
    v_acceptor_pay_status TEXT;
    v_arena_name TEXT := 'Arena';
    v_caller_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Fetch challenge
    SELECT * INTO v_challenge
    FROM public.challenges
    WHERE id = p_challenge_id::UUID;

    IF v_challenge.id IS NULL THEN
        RAISE EXCEPTION 'Challenge not found';
    END IF;

    -- Verify caller is challenger
    IF v_challenge.challenger_id <> v_caller_id THEN
        RAISE EXCEPTION 'Only the challenger can accept requests';
    END IF;

    -- Fetch user profiles
    SELECT * INTO v_challenger_profile FROM public.user_profiles WHERE id = v_caller_id;
    SELECT * INTO v_requester_profile FROM public.user_profiles WHERE id = p_requester_id::UUID;

    -- Fetch box location if available
    IF v_challenge.box_id IS NOT NULL THEN
        SELECT * INTO v_box FROM public.locations WHERE id = v_challenge.box_id;
        IF v_box.name IS NOT NULL THEN
            v_arena_name := v_box.name;
        END IF;
    END IF;

    -- Check advance payment requirement
    IF v_challenge.payment_type = 'advance' OR (v_box.min_advance IS NOT NULL AND v_box.min_advance > 0) OR (v_challenge.advance_price IS NOT NULL AND v_challenge.advance_price > 0) THEN
        v_is_advance := TRUE;
    END IF;

    IF v_is_advance THEN
        v_initial_status := 'pending_payment';
        v_acceptor_pay_status := 'pending';
    ELSE
        v_initial_status := 'booked';
        v_acceptor_pay_status := 'paid';
    END IF;

    -- Update challenge status
    UPDATE public.challenges
    SET status = v_initial_status,
        accepted_by = p_requester_id::UUID,
        acceptor_payment_status = v_acceptor_pay_status,
        updated_at = NOW()
    WHERE id = p_challenge_id::UUID;

    -- Insert notifications for both parties
    INSERT INTO public.notifications (user_id, title, message, is_read, target_url, data)
    VALUES
    (
        p_requester_id::UUID,
        CASE WHEN v_is_advance THEN 'CHALLENGE REQUEST ACCEPTED - PAYMENT REQUIRED' ELSE 'CHALLENGE REQUEST ACCEPTED!' END,
        CASE WHEN v_is_advance
            THEN COALESCE(v_challenger_profile.display_name, 'Host') || ' accepted your request. Please pay the advance to confirm the match.'
            ELSE COALESCE(v_challenger_profile.display_name, 'A player') || ' accepted your challenge request. Match booked for ' || v_arena_name || ' at ' || COALESCE(v_challenge.slot_time, 'TBA') || '!'
        END,
        FALSE,
        CASE WHEN v_is_advance THEN '/challenges?id=' || p_challenge_id ELSE NULL END,
        jsonb_build_object(
            'type', CASE WHEN v_is_advance THEN 'challenge_payment_pending' ELSE 'challenge_confirmed' END,
            'challenge_id', p_challenge_id,
            'challenger_id', v_caller_id::TEXT,
            'requester_id', p_requester_id,
            'date', v_challenge.date,
            'slot_time', v_challenge.slot_time,
            'sport', COALESCE(v_challenge.sport, 'Box Cricket'),
            'challenger_details', jsonb_build_object(
                'username', v_challenger_profile.username,
                'display_name', v_challenger_profile.display_name,
                'phone_number', v_challenger_profile.phone_number,
                'avatar_url', v_challenger_profile.avatar_url
            )
        )
    ),
    (
        v_caller_id,
        CASE WHEN v_is_advance THEN 'WAITING FOR ACCEPTOR PAYMENT' ELSE 'CHALLENGE REQUEST ACCEPTED!' END,
        CASE WHEN v_is_advance
            THEN 'You accepted ' || COALESCE(v_requester_profile.display_name, 'a player') || '. Match will be confirmed once they pay the advance.'
            ELSE 'You have accepted the request from ' || COALESCE(v_requester_profile.display_name, 'a player') || ' for ' || v_arena_name || ' at ' || COALESCE(v_challenge.slot_time, 'TBA') || '. Match booked!'
        END,
        FALSE,
        NULL,
        jsonb_build_object(
            'type', CASE WHEN v_is_advance THEN 'challenge_waiting_payment' ELSE 'challenge_confirmed_host' END,
            'challenge_id', p_challenge_id,
            'requester_id', p_requester_id,
            'challenger_id', v_caller_id::TEXT,
            'date', v_challenge.date,
            'slot_time', v_challenge.slot_time,
            'sport', COALESCE(v_challenge.sport, 'Box Cricket'),
            'requester_details', jsonb_build_object(
                'username', v_requester_profile.username,
                'display_name', v_requester_profile.display_name,
                'phone_number', v_requester_profile.phone_number,
                'avatar_url', v_requester_profile.avatar_url
            )
        )
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'status', v_initial_status,
        'is_advance', v_is_advance,
        'accepted_by', p_requester_id
    );
END;
$$;
