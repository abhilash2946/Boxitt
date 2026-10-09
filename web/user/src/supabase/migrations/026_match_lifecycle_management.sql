-- =============================================================================
-- MIGRATION 026: Match Lifecycle Management & Auto-Cleanup
-- Description: Handles match status transitions and 24h deletion.
-- =============================================================================

-- 1. Add timing columns to matches table
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;

-- 2. Function to refresh match statuses and cleanup
-- This can be called by the application or a trigger
CREATE OR REPLACE FUNCTION public.refresh_match_statuses(p_location_id UUID DEFAULT NULL)
RETURNS void AS $$
BEGIN
    -- Transition 'not started' to 'live' if within 15 mins of start
    UPDATE public.matches
    SET status = 'live'
    WHERE status = 'not started'
      AND now() >= (start_time - interval '15 minutes')
      AND now() <= (end_time + interval '5 minutes');

    -- Transition 'live' or 'not started' to 'abandoned' if time passed
    UPDATE public.matches
    SET status = 'abandoned'
    WHERE status IN ('live', 'not started')
      AND now() > (end_time + interval '5 minutes');

    -- Delete 'finished' or 'abandoned' matches older than 24 hours
    DELETE FROM public.matches
    WHERE status IN ('finished', 'abandoned')
      AND updated_at < (now() - interval '24 hours');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update the trigger function to include timing and initial 'not started' status
CREATE OR REPLACE FUNCTION public.create_match_from_challenge()
RETURNS TRIGGER AS $$
DECLARE
    challenger_name TEXT;
    target_name     TEXT;
    loc_id          UUID;
    sport_name      TEXT;
    initial_match_data JSONB;
    default_squad   JSONB;
    default_batsmen JSONB;
    v_start_time    TIMESTAMPTZ;
    v_end_time      TIMESTAMPTZ;
    v_date_parts    TEXT[];
    v_iso_date      TEXT;
BEGIN
    -- Only trigger when status changes to 'confirmed'
    IF (TG_OP = 'UPDATE' AND NEW.status = 'confirmed' AND OLD.status <> 'confirmed') OR
       (TG_OP = 'INSERT' AND NEW.status = 'confirmed') THEN

        -- Fetch challenger name
        SELECT display_name INTO challenger_name FROM public.user_profiles WHERE id = NEW.challenger_id;
        -- Fetch target (accepted_by) name
        SELECT display_name INTO target_name FROM public.user_profiles WHERE id = NEW.accepted_by;

        -- Get location and sport from booking if exists, otherwise from challenge
        IF NEW.booking_id IS NOT NULL THEN
            SELECT location_id, sport INTO loc_id, sport_name FROM public.bookings WHERE id = NEW.booking_id::text;
        ELSE
            loc_id := NEW.box_id;
            sport_name := NEW.sport;
        END IF;

        IF sport_name IS NULL THEN sport_name := NEW.sport; END IF;

        -- Parse date and hours into TIMESTAMPTZ
        -- Supports YYYY-MM-DD and DD/MM/YYYY
        IF NEW.date LIKE '%-%' THEN
            v_iso_date := NEW.date; -- Assume YYYY-MM-DD
        ELSIF NEW.date LIKE '%/%' THEN
            v_date_parts := string_to_array(NEW.date, '/');
            v_iso_date := v_date_parts[3] || '-' || v_date_parts[2] || '-' || v_date_parts[1];
        END IF;

        IF v_iso_date IS NOT NULL THEN
            v_start_time := (v_iso_date || ' 00:00:00')::TIMESTAMPTZ + (NEW.start_hour * interval '1 hour');
            v_end_time := (v_iso_date || ' 00:00:00')::TIMESTAMPTZ + (NEW.end_hour * interval '1 hour');

            -- Handle overnight slots (end hour < start hour)
            IF NEW.end_hour < NEW.start_hour THEN
                v_end_time := v_end_time + interval '1 day';
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
                    'id', NEW.id,
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
                    'id', NEW.id,
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
                    'id', NEW.id,
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
            NEW.id,
            NEW.booking_id::text,
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
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
