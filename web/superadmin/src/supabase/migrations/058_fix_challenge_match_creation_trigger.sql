-- =============================================================================
-- MIGRATION 058: Fix Challenge Match (Scorer) Creation Trigger
-- Description: Ensures matches are automatically created in the public.matches
--              table as soon as a challenge is 'booked' (accepted + advance paid)
--              or 'confirmed', so scorer sessions appear immediately on the Matchboard.
--              Also backfills missing matches for existing booked/confirmed challenges.
-- =============================================================================

-- 1. Helper function to safely create a match for a given challenge ID
CREATE OR REPLACE FUNCTION public.create_match_for_challenge_id(p_challenge_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_challenge        RECORD;
    challenger_name    TEXT;
    target_name        TEXT;
    loc_id             UUID;
    sport_name         TEXT;
    initial_match_data JSONB;
    default_squad      JSONB;
    default_batsmen    JSONB;
    v_start_time       TIMESTAMPTZ;
    v_end_time         TIMESTAMPTZ;
    v_date_parts       TEXT[];
    v_iso_date         TEXT;
BEGIN
    -- Fetch challenge record
    SELECT * INTO v_challenge FROM public.challenges WHERE id = p_challenge_id;
    IF v_challenge.id IS NULL THEN
        RETURN;
    END IF;

    -- Only create if status is 'booked' or 'confirmed'
    IF v_challenge.status NOT IN ('booked', 'confirmed') THEN
        RETURN;
    END IF;

    -- Check if match already exists for this challenge
    IF EXISTS (SELECT 1 FROM public.matches WHERE challenge_id = p_challenge_id) THEN
        RETURN;
    END IF;

    -- Fetch challenger name
    SELECT display_name INTO challenger_name FROM public.user_profiles WHERE id = v_challenge.challenger_id;
    -- Fetch target (accepted_by) name
    IF v_challenge.accepted_by IS NOT NULL THEN
        SELECT display_name INTO target_name FROM public.user_profiles WHERE id = v_challenge.accepted_by;
    END IF;

    -- Get location and sport from booking if exists, otherwise from challenge
    IF v_challenge.booking_id IS NOT NULL THEN
        SELECT location_id, sport INTO loc_id, sport_name FROM public.bookings WHERE id = v_challenge.booking_id::text;
    END IF;

    IF loc_id IS NULL THEN
        loc_id := v_challenge.box_id;
    END IF;

    IF sport_name IS NULL THEN
        sport_name := v_challenge.sport;
    END IF;

    -- Robust Date Parsing
    IF v_challenge.date ~ '^\d{4}-\d{2}-\d{2}$' THEN
        v_iso_date := v_challenge.date;
    ELSIF v_challenge.date ~ '^\d{1,2}/\d{1,2}/\d{4}$' THEN
        v_date_parts := string_to_array(v_challenge.date, '/');
        v_iso_date := v_date_parts[3] || '-' || LPAD(v_date_parts[2], 2, '0') || '-' || LPAD(v_date_parts[1], 2, '0');
    ELSIF v_challenge.date ~ '^\d{1,2}-\d{1,2}-\d{4}$' THEN
        v_date_parts := string_to_array(v_challenge.date, '-');
        v_iso_date := v_date_parts[3] || '-' || LPAD(v_date_parts[2], 2, '0') || '-' || LPAD(v_date_parts[1], 2, '0');
    END IF;

    IF v_iso_date IS NOT NULL AND v_challenge.start_hour IS NOT NULL THEN
        v_start_time := ((v_iso_date || ' 00:00:00')::TIMESTAMP + (v_challenge.start_hour * interval '1 hour')) AT TIME ZONE 'Asia/Kolkata';
        IF v_challenge.end_hour IS NOT NULL THEN
            v_end_time := ((v_iso_date || ' 00:00:00')::TIMESTAMP + (v_challenge.end_hour * interval '1 hour')) AT TIME ZONE 'Asia/Kolkata';
            IF v_challenge.end_hour < v_challenge.start_hour THEN
                v_end_time := v_end_time + interval '1 day';
            END IF;
        END IF;
    END IF;

    -- Prepare squads
    default_squad := jsonb_build_array(
        'Player 1', 'Player 2', 'Player 3', 'Player 4', 'Player 5',
        'Player 6', 'Player 7', 'Player 8', 'Player 9', 'Player 10', 'Player 11'
    );

    default_batsmen := jsonb_build_array(
        jsonb_build_object('name', 'Player 1', 'runs', 0, 'balls', 0, 'fours', 0, 'sixes', 0, 'isOut', false),
        jsonb_build_object('name', 'Player 2', 'runs', 0, 'balls', 0, 'fours', 0, 'sixes', 0, 'isOut', false),
        jsonb_build_object('name', 'Player 3', 'runs', 0, 'balls', 0, 'fours', 0, 'sixes', 0, 'isOut', false),
        jsonb_build_object('name', 'Player 4', 'runs', 0, 'balls', 0, 'fours', 0, 'sixes', 0, 'isOut', false),
        jsonb_build_object('name', 'Player 5', 'runs', 0, 'balls', 0, 'fours', 0, 'sixes', 0, 'isOut', false),
        jsonb_build_object('name', 'Player 6', 'runs', 0, 'balls', 0, 'fours', 0, 'sixes', 0, 'isOut', false),
        jsonb_build_object('name', 'Player 7', 'runs', 0, 'balls', 0, 'fours', 0, 'sixes', 0, 'isOut', false),
        jsonb_build_object('name', 'Player 8', 'runs', 0, 'balls', 0, 'fours', 0, 'sixes', 0, 'isOut', false),
        jsonb_build_object('name', 'Player 9', 'runs', 0, 'balls', 0, 'fours', 0, 'sixes', 0, 'isOut', false),
        jsonb_build_object('name', 'Player 10', 'runs', 0, 'balls', 0, 'fours', 0, 'sixes', 0, 'isOut', false),
        jsonb_build_object('name', 'Player 11', 'runs', 0, 'balls', 0, 'fours', 0, 'sixes', 0, 'isOut', false)
    );

    -- Prepare sport-specific initial match data
    CASE
        WHEN sport_name ILIKE '%Cricket%' THEN
            initial_match_data := jsonb_build_object(
                'id', v_challenge.id,
                'locationId', loc_id,
                'teamA', COALESCE(challenger_name, 'Team A'),
                'teamB', COALESCE(target_name, 'Team B'),
                'tossWinner', COALESCE(challenger_name, 'Team A'),
                'optedTo', 'Bat',
                'status', 'Live',
                'sport', 'Box Cricket',
                'overs', 16,
                'teamASize', 11,
                'teamBSize', 11,
                'teamAPlayers', default_squad,
                'teamBPlayers', default_squad,
                'innings', jsonb_build_array(
                    jsonb_build_object(
                        'battingTeam', COALESCE(challenger_name, 'Team A'),
                        'runs', 0, 'wickets', 0, 'balls', 0, 'overs', 0,
                        'isFreeHit', false, 'isNoBallRunPending', false,
                        'extras', jsonb_build_object('wides', 0, 'noBalls', 0, 'byes', 0, 'legByes', 0),
                        'batsmen', default_batsmen,
                        'bowlers', jsonb_build_array(jsonb_build_object('name', 'Bowler 1', 'overs', 0, 'maidens', 0, 'runs', 0, 'wickets', 0)),
                        'ballByBall', jsonb_build_array(),
                        'strikerIdx', 0,
                        'nonStrikerIdx', 1,
                        'currentBowlerIdx', 0,
                        'nextBatsmanIdx', 2
                    )
                ),
                'currentInningsIdx', 0,
                'createdAt', now()
            );
        WHEN sport_name ILIKE '%Football%' THEN
            initial_match_data := jsonb_build_object(
                'id', v_challenge.id,
                'teamA', COALESCE(challenger_name, 'Team A'),
                'teamB', COALESCE(target_name, 'Team B'),
                'scoreA', 0, 'scoreB', 0,
                'status', 'Live',
                'period', 1,
                'events', jsonb_build_array(),
                'createdAt', now()
            );
        ELSE
            initial_match_data := jsonb_build_object(
                'id', v_challenge.id,
                'teamA', COALESCE(challenger_name, 'Team A'),
                'teamB', COALESCE(target_name, 'Team B'),
                'status', 'Live',
                'createdAt', now()
            );
    END CASE;

    -- Insert into matches with 'not started' status
    INSERT INTO public.matches (
        challenge_id,
        booking_id,
        location_id,
        sport,
        team_a_name,
        team_b_name,
        status,
        match_data,
        start_time,
        end_time
    ) VALUES (
        v_challenge.id,
        v_challenge.booking_id::text,
        loc_id,
        COALESCE(sport_name, 'Other'),
        COALESCE(challenger_name, 'Team A'),
        COALESCE(target_name, 'Team B'),
        'not started',
        initial_match_data,
        v_start_time,
        v_end_time
    );

    -- Run a lifecycle check immediately
    PERFORM public.refresh_match_statuses(loc_id);
END;
$$;


-- 2. Update trigger function to listen for 'booked' and 'confirmed' statuses
CREATE OR REPLACE FUNCTION public.create_match_from_challenge()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('booked', 'confirmed') THEN
        PERFORM public.create_match_for_challenge_id(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Ensure trigger is attached to public.challenges
DROP TRIGGER IF EXISTS trg_create_match_on_challenge_confirmed ON public.challenges;
CREATE TRIGGER trg_create_match_on_challenge_confirmed
    AFTER INSERT OR UPDATE ON public.challenges
    FOR EACH ROW EXECUTE FUNCTION public.create_match_from_challenge();


-- 4. Update confirm_challenge_payment RPC to explicitly trigger match creation
CREATE OR REPLACE FUNCTION public.confirm_challenge_payment(
    p_challenge_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_challenge RECORD;
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

    -- Verify caller is either the acceptor or the challenger
    IF (v_challenge.accepted_by IS NOT NULL AND v_challenge.accepted_by <> v_caller_id) AND v_challenge.challenger_id <> v_caller_id THEN
        RAISE EXCEPTION 'Not authorized to confirm payment for this challenge';
    END IF;

    -- Update challenge status to booked and acceptor_payment_status to paid
    UPDATE public.challenges
    SET status = 'booked',
        acceptor_payment_status = 'paid',
        updated_at = NOW()
    WHERE id = p_challenge_id::UUID;

    -- Also update linked booking if exists
    IF v_challenge.booking_id IS NOT NULL THEN
        UPDATE public.bookings
        SET status = 'booked',
            updated_at = NOW()
        WHERE id = v_challenge.booking_id::TEXT;
    END IF;

    -- Ensure match session is created
    PERFORM public.create_match_for_challenge_id(p_challenge_id::UUID);

    RETURN jsonb_build_object(
        'success', TRUE,
        'challenge_id', p_challenge_id,
        'status', 'booked',
        'acceptor_payment_status', 'paid'
    );
END;
$$;


-- 5. Backfill matches for any existing booked or confirmed challenges missing match records
DO $$
DECLARE
    c RECORD;
BEGIN
    FOR c IN
        SELECT id FROM public.challenges
        WHERE status IN ('booked', 'confirmed')
          AND id NOT IN (SELECT challenge_id FROM public.matches WHERE challenge_id IS NOT NULL)
    LOOP
        PERFORM public.create_match_for_challenge_id(c.id);
    END LOOP;
END;
$$;
