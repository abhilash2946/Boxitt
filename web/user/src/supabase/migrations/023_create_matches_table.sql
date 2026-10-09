-- =============================================================================
-- MIGRATION 023: Enhanced Challenge Flow & Result-Based Payouts
-- Description: Schema and triggers for payment tracking, results, and settlements.
-- =============================================================================

-- Add tracking columns to challenges
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS challenger_payment_status TEXT DEFAULT 'paid';
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS acceptor_payment_status TEXT DEFAULT 'pending';
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS settlement_status TEXT DEFAULT 'pending';
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'advance';

-- =============================================================================
-- TABLE: matches
-- Stores live and historical score data for all sports.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.matches (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id  UUID REFERENCES public.challenges(id) ON DELETE SET NULL,
    booking_id    TEXT REFERENCES public.bookings(id) ON DELETE SET NULL,
    location_id   UUID REFERENCES public.locations(id) ON DELETE CASCADE,
    sport         TEXT NOT NULL,
    team_a_name   TEXT,
    team_b_name   TEXT,
    score_a       TEXT DEFAULT '0',
    score_b       TEXT DEFAULT '0',
    match_data    JSONB DEFAULT '{}'::jsonb,
    status        TEXT DEFAULT 'live', -- 'live', 'finished', 'abandoned'
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- TABLE: match_results
-- Temporary storage for winner/loser to trigger settlement.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.match_results (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id  UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    winner_id     UUID REFERENCES public.users(id),
    loser_id      UUID REFERENCES public.users(id),
    score_summary TEXT,
    created_at    TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public can view matches" ON public.matches FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated users can manage matches" ON public.matches FOR ALL TO authenticated USING (true);

CREATE POLICY "Users can view relevant match results" ON public.match_results
    FOR SELECT TO authenticated
    USING (auth.uid() = winner_id OR auth.uid() = loser_id);

CREATE POLICY "Authenticated users can insert results" ON public.match_results
    FOR INSERT TO authenticated WITH CHECK (true);

-- =============================================================================
-- TRIGGER: auto_delete_match_results
-- Purge results after 24 hours.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.delete_old_match_results()
RETURNS void AS $$
BEGIN
    DELETE FROM public.match_results WHERE created_at < now() - interval '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Note: In a real production environment, this would be a CRON job.
-- For this migration, we'll rely on the trigger below to keep things lean.
CREATE OR REPLACE FUNCTION public.cleanup_old_results_trigger()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.match_results WHERE created_at < now() - interval '24 hours';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cleanup_match_results
    AFTER INSERT ON public.match_results
    FOR EACH STATEMENT EXECUTE FUNCTION public.cleanup_old_results_trigger();

-- =============================================================================
-- Function to auto-create match from confirmed challenge
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_match_from_challenge()
RETURNS TRIGGER AS $$
DECLARE
    challenger_name TEXT;
    target_name     TEXT;
    loc_id          UUID;
    sport_name      TEXT;
    initial_match_data JSONB;
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

        -- Prepare sport-specific initial match data
        CASE
            WHEN sport_name ILIKE '%Cricket%' THEN
                initial_match_data := jsonb_build_object(
                    'id', NEW.id,
                    'teamA', COALESCE(challenger_name, 'Team A'),
                    'teamB', COALESCE(target_name, 'Team B'),
                    'status', 'Live',
                    'overs', 16,
                    'innings', jsonb_build_array(
                        jsonb_build_object('battingTeam', COALESCE(challenger_name, 'Team A'), 'runs', 0, 'wickets', 0, 'balls', 0, 'overs', 0, 'batsmen', jsonb_build_array(), 'bowlers', jsonb_build_array(), 'ballByBall', jsonb_build_array()),
                        jsonb_build_object('battingTeam', COALESCE(target_name, 'Team B'), 'runs', 0, 'wickets', 0, 'balls', 0, 'overs', 0, 'batsmen', jsonb_build_array(), 'bowlers', jsonb_build_array(), 'ballByBall', jsonb_build_array())
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

-- Trigger for challenges
DROP TRIGGER IF EXISTS trg_create_match_on_challenge_confirmed ON public.challenges;
CREATE TRIGGER trg_create_match_on_challenge_confirmed
    AFTER INSERT OR UPDATE ON public.challenges
    FOR EACH ROW EXECUTE FUNCTION public.create_match_from_challenge();
