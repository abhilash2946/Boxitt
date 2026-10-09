-- =============================================================================
-- MIGRATION 025: Fix Cricket Match Initialization from Challenges
-- Description: Updates create_match_from_challenge to properly initialize Cricket matches.
-- =============================================================================

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
            WHEN sport_name ILIKE '%Basketball%' THEN
                initial_match_data := jsonb_build_object(
                    'id', NEW.id,
                    'teamA', COALESCE(challenger_name, 'Team A'),
                    'teamB', COALESCE(target_name, 'Team B'),
                    'status', 'Live',
                    'teamAData', jsonb_build_object('score', 0, 'players', jsonb_build_array()),
                    'teamBData', jsonb_build_object('score', 0, 'players', jsonb_build_array()),
                    'createdAt', now()
                );
            WHEN sport_name ILIKE '%Tennis%' THEN
                initial_match_data := jsonb_build_object(
                    'id', NEW.id,
                    'playerA', COALESCE(challenger_name, 'Player A'),
                    'playerB', COALESCE(target_name, 'Player B'),
                    'status', 'Live',
                    'pointsA', 0, 'pointsB', 0,
                    'gamesA', 0, 'gamesB', 0,
                    'setsA', 0, 'setsB', 0,
                    'setFormat', 3,
                    'createdAt', now()
                );
            WHEN sport_name ILIKE '%Badminton%' THEN
                initial_match_data := jsonb_build_object(
                    'id', NEW.id,
                    'playerA', COALESCE(challenger_name, 'Player A'),
                    'playerB', COALESCE(target_name, 'Player B'),
                    'status', 'Live',
                    'scoreA', 0, 'scoreB', 0,
                    'gamesA', 0, 'gamesB', 0,
                    'gameScores', jsonb_build_array(),
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

        -- Insert into matches
        INSERT INTO public.matches (
            challenge_id,
            booking_id,
            location_id,
            sport,
            team_a_name,
            team_b_name,
            status,
            match_data
        ) VALUES (
            NEW.id,
            NEW.booking_id::text,
            loc_id,
            COALESCE(sport_name, 'Other'),
            COALESCE(challenger_name, 'Team A'),
            COALESCE(target_name, 'Team B'),
            'live',
            initial_match_data
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
