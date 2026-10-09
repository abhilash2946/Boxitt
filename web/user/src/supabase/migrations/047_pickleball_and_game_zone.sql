-- =============================================================================
-- MIGRATION 047: Add Pickleball & Resource-Based Game Zone Infrastructure (Hardened)
-- Description:
-- 1. Game Zone schema (game_zones, platforms, resources, games, blockouts)
-- 2. Add resource_id, platform_id, game_id, selected_game to bookings table
-- 3. Strict Row Level Security policies for Game Zone tables (Admin/Superadmin write)
-- 4. Overhaul create_booking_atomic RPC with server-authoritative price & max_players derivation
-- =============================================================================

-- 1. GAME ZONES TABLE
CREATE TABLE IF NOT EXISTS public.game_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. GAME ZONE PLATFORMS TABLE (e.g., PlayStation, Xbox, Gaming PC, Nintendo, VR, Arcade)
CREATE TABLE IF NOT EXISTS public.game_zone_platforms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_zone_id UUID REFERENCES public.game_zones(id) ON DELETE CASCADE,
    location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. GAME ZONE RESOURCES / STATIONS TABLE (e.g., PS5-01, PC-01)
CREATE TABLE IF NOT EXISTS public.game_zone_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_zone_id UUID REFERENCES public.game_zones(id) ON DELETE CASCADE,
    platform_id UUID REFERENCES public.game_zone_platforms(id) ON DELETE CASCADE,
    location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
    platform_type TEXT NOT NULL DEFAULT 'PlayStation',
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL DEFAULT 200.00,
    pricing_unit TEXT NOT NULL DEFAULT 'per hour',
    max_players INT NOT NULL DEFAULT 4,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'INACTIVE', 'MAINTENANCE', 'BLOCKED'
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. GAME ZONE GAMES CATALOG TABLE
CREATE TABLE IF NOT EXISTS public.game_zone_games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    platform_type TEXT,
    image_url TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. GAME ZONE RESOURCE GAMES MAPPING TABLE
CREATE TABLE IF NOT EXISTS public.game_zone_resource_games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL REFERENCES public.game_zone_resources(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES public.game_zone_games(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(resource_id, game_id)
);

-- 6. GAME ZONE BLOCKOUTS TABLE
CREATE TABLE IF NOT EXISTS public.game_zone_blockouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL REFERENCES public.game_zone_resources(id) ON DELETE CASCADE,
    location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. ADD RESOURCE & GAME COLUMNS TO BOOKINGS TABLE
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS resource_id UUID REFERENCES public.game_zone_resources(id) ON DELETE SET NULL;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS platform_id UUID REFERENCES public.game_zone_platforms(id) ON DELETE SET NULL;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS game_id UUID REFERENCES public.game_zone_games(id) ON DELETE SET NULL;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS selected_game TEXT;

-- 8. STRICT ROW LEVEL SECURITY POLICIES
ALTER TABLE public.game_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_zone_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_zone_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_zone_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_zone_resource_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_zone_blockouts ENABLE ROW LEVEL SECURITY;

-- Drop any loose legacy policies
DROP POLICY IF EXISTS "game_zones_select" ON public.game_zones;
DROP POLICY IF EXISTS "game_zone_platforms_select" ON public.game_zone_platforms;
DROP POLICY IF EXISTS "game_zone_resources_select" ON public.game_zone_resources;
DROP POLICY IF EXISTS "game_zone_games_select" ON public.game_zone_games;
DROP POLICY IF EXISTS "game_zone_resource_games_select" ON public.game_zone_resource_games;
DROP POLICY IF EXISTS "game_zone_blockouts_select" ON public.game_zone_blockouts;

DROP POLICY IF EXISTS "game_zones_admin" ON public.game_zones;
DROP POLICY IF EXISTS "game_zone_platforms_admin" ON public.game_zone_platforms;
DROP POLICY IF EXISTS "game_zone_resources_admin" ON public.game_zone_resources;
DROP POLICY IF EXISTS "game_zone_games_admin" ON public.game_zone_games;
DROP POLICY IF EXISTS "game_zone_resource_games_admin" ON public.game_zone_resource_games;
DROP POLICY IF EXISTS "game_zone_blockouts_admin" ON public.game_zone_blockouts;

-- PUBLIC / AUTHENTICATED READ POLICIES
CREATE POLICY "game_zones_read_policy" ON public.game_zones FOR SELECT TO public USING (true);
CREATE POLICY "game_zone_platforms_read_policy" ON public.game_zone_platforms FOR SELECT TO public USING (true);
CREATE POLICY "game_zone_resources_read_policy" ON public.game_zone_resources FOR SELECT TO public USING (true);
CREATE POLICY "game_zone_games_read_policy" ON public.game_zone_games FOR SELECT TO public USING (true);
CREATE POLICY "game_zone_resource_games_read_policy" ON public.game_zone_resource_games FOR SELECT TO public USING (true);
CREATE POLICY "game_zone_blockouts_read_policy" ON public.game_zone_blockouts FOR SELECT TO public USING (true);

-- ADMIN / SUPERADMIN RESTRICTED WRITE POLICIES
CREATE POLICY "game_zones_admin_write_policy" ON public.game_zones
FOR ALL TO public
USING (
    is_superadmin()
    OR EXISTS (
        SELECT 1 FROM public.admin_accounts
        WHERE admin_accounts.user_id = auth.uid()
          AND admin_accounts.location_id = game_zones.location_id
    )
)
WITH CHECK (
    is_superadmin()
    OR EXISTS (
        SELECT 1 FROM public.admin_accounts
        WHERE admin_accounts.user_id = auth.uid()
          AND admin_accounts.location_id = game_zones.location_id
    )
);

CREATE POLICY "game_zone_platforms_admin_write_policy" ON public.game_zone_platforms
FOR ALL TO public
USING (
    is_superadmin()
    OR EXISTS (
        SELECT 1 FROM public.admin_accounts
        WHERE admin_accounts.user_id = auth.uid()
          AND admin_accounts.location_id = game_zone_platforms.location_id
    )
)
WITH CHECK (
    is_superadmin()
    OR EXISTS (
        SELECT 1 FROM public.admin_accounts
        WHERE admin_accounts.user_id = auth.uid()
          AND admin_accounts.location_id = game_zone_platforms.location_id
    )
);

CREATE POLICY "game_zone_resources_admin_write_policy" ON public.game_zone_resources
FOR ALL TO public
USING (
    is_superadmin()
    OR EXISTS (
        SELECT 1 FROM public.admin_accounts
        WHERE admin_accounts.user_id = auth.uid()
          AND admin_accounts.location_id = game_zone_resources.location_id
    )
)
WITH CHECK (
    is_superadmin()
    OR EXISTS (
        SELECT 1 FROM public.admin_accounts
        WHERE admin_accounts.user_id = auth.uid()
          AND admin_accounts.location_id = game_zone_resources.location_id
    )
);

CREATE POLICY "game_zone_games_admin_write_policy" ON public.game_zone_games
FOR ALL TO public
USING (
    is_superadmin()
    OR EXISTS (
        SELECT 1 FROM public.admin_accounts
        WHERE admin_accounts.user_id = auth.uid()
          AND admin_accounts.location_id = game_zone_games.location_id
    )
)
WITH CHECK (
    is_superadmin()
    OR EXISTS (
        SELECT 1 FROM public.admin_accounts
        WHERE admin_accounts.user_id = auth.uid()
          AND admin_accounts.location_id = game_zone_games.location_id
    )
);

CREATE POLICY "game_zone_resource_games_admin_write_policy" ON public.game_zone_resource_games
FOR ALL TO public
USING (
    is_superadmin()
    OR EXISTS (
        SELECT 1 FROM public.game_zone_resources res
        JOIN public.admin_accounts adm ON adm.location_id = res.location_id
        WHERE res.id = game_zone_resource_games.resource_id
          AND adm.user_id = auth.uid()
    )
)
WITH CHECK (
    is_superadmin()
    OR EXISTS (
        SELECT 1 FROM public.game_zone_resources res
        JOIN public.admin_accounts adm ON adm.location_id = res.location_id
        WHERE res.id = game_zone_resource_games.resource_id
          AND adm.user_id = auth.uid()
    )
);

CREATE POLICY "game_zone_blockouts_admin_write_policy" ON public.game_zone_blockouts
FOR ALL TO public
USING (
    is_superadmin()
    OR EXISTS (
        SELECT 1 FROM public.admin_accounts
        WHERE admin_accounts.user_id = auth.uid()
          AND admin_accounts.location_id = game_zone_blockouts.location_id
    )
)
WITH CHECK (
    is_superadmin()
    OR EXISTS (
        SELECT 1 FROM public.admin_accounts
        WHERE admin_accounts.user_id = auth.uid()
          AND admin_accounts.location_id = game_zone_blockouts.location_id
    )
);

-- 9. SERVER-AUTHORITATIVE ATOMIC BOOKING FUNCTION
CREATE OR REPLACE FUNCTION public.create_booking_atomic(p_booking JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_name TEXT;
    v_phone TEXT;
    v_date DATE;
    v_location_uuid UUID;
    v_court_uuid UUID;
    v_resource_uuid UUID;
    v_platform_uuid UUID;
    v_game_uuid UUID;
    v_selected_game TEXT;
    v_user_uuid UUID;
    v_slot_id TEXT;
    v_slot_time TEXT;
    v_start_hour NUMERIC;
    v_end_hour NUMERIC;
    v_duration NUMERIC;
    v_amount NUMERIC;
    v_advance_paid NUMERIC;
    v_advance_price NUMERIC;
    v_status TEXT;
    v_payment_method TEXT;
    v_payment_type TEXT;
    v_booked_by TEXT;
    v_is_joinable BOOLEAN;
    v_max_players INT;
    v_current_players INT;
    v_sport TEXT;

    v_lock_key BIGINT;
    v_overlapping_count INT;
    v_blockout_count INT;
    v_max_capacity INT;
    v_current_total INT;
    v_res_price NUMERIC;
    v_res_status TEXT;
    v_res_max_players INT;
    v_res_location_id UUID;
    v_new_booking public.bookings%ROWTYPE;
    v_booking_id UUID;
BEGIN
    -- Derive authenticated user ID if available
    IF auth.uid() IS NOT NULL THEN
        v_user_uuid := auth.uid();
    ELSIF p_booking->>'user_id' IS NOT NULL AND p_booking->>'user_id' <> '' THEN
        v_user_uuid := (p_booking->>'user_id')::UUID;
    ELSIF p_booking->>'p_user_id' IS NOT NULL AND p_booking->>'p_user_id' <> '' THEN
        v_user_uuid := (p_booking->>'p_user_id')::UUID;
    ELSE
        v_user_uuid := NULL;
    END IF;

    -- Extract basic values
    v_name := COALESCE(p_booking->>'name', p_booking->>'p_name', 'Guest');
    v_phone := COALESCE(p_booking->>'phone', p_booking->>'p_phone', '0000000000');
    v_date := (COALESCE(p_booking->>'date', p_booking->>'p_date'))::DATE;
    v_location_uuid := (COALESCE(p_booking->>'locationId', p_booking->>'location_id', p_booking->>'p_location_id'))::UUID;

    -- Court ID
    IF p_booking->>'courtId' IS NOT NULL AND p_booking->>'courtId' <> '' THEN
        v_court_uuid := (p_booking->>'courtId')::UUID;
    ELSIF p_booking->>'court_id' IS NOT NULL AND p_booking->>'court_id' <> '' THEN
        v_court_uuid := (p_booking->>'court_id')::UUID;
    ELSE
        v_court_uuid := NULL;
    END IF;

    -- Resource ID (Game Zone)
    IF p_booking->>'resourceId' IS NOT NULL AND p_booking->>'resourceId' <> '' THEN
        v_resource_uuid := (p_booking->>'resourceId')::UUID;
    ELSIF p_booking->>'resource_id' IS NOT NULL AND p_booking->>'resource_id' <> '' THEN
        v_resource_uuid := (p_booking->>'resource_id')::UUID;
    ELSE
        v_resource_uuid := NULL;
    END IF;

    -- Platform ID (Game Zone)
    IF p_booking->>'platformId' IS NOT NULL AND p_booking->>'platformId' <> '' THEN
        v_platform_uuid := (p_booking->>'platformId')::UUID;
    ELSIF p_booking->>'platform_id' IS NOT NULL AND p_booking->>'platform_id' <> '' THEN
        v_platform_uuid := (p_booking->>'platform_id')::UUID;
    ELSE
        v_platform_uuid := NULL;
    END IF;

    -- Game ID (Game Zone)
    IF p_booking->>'gameId' IS NOT NULL AND p_booking->>'gameId' <> '' THEN
        v_game_uuid := (p_booking->>'gameId')::UUID;
    ELSIF p_booking->>'game_id' IS NOT NULL AND p_booking->>'game_id' <> '' THEN
        v_game_uuid := (p_booking->>'game_id')::UUID;
    ELSE
        v_game_uuid := NULL;
    END IF;

    v_selected_game := COALESCE(p_booking->>'selectedGame', p_booking->>'selected_game');

    v_slot_id := COALESCE(p_booking->>'slotId', p_booking->>'slot_id', p_booking->>'p_slot_id');
    v_slot_time := COALESCE(p_booking->>'slotTime', p_booking->>'slot_time', p_booking->>'p_slot_time');
    v_start_hour := COALESCE((p_booking->>'startHour')::NUMERIC, (p_booking->>'start_hour')::NUMERIC, 0);
    v_end_hour := COALESCE((p_booking->>'endHour')::NUMERIC, (p_booking->>'end_hour')::NUMERIC, 1);
    v_duration := GREATEST(1, COALESCE((p_booking->>'duration')::NUMERIC, (v_end_hour - v_start_hour), 1));
    v_status := 'booked';
    v_payment_method := COALESCE(p_booking->>'paymentMethod', p_booking->>'payment_method', 'online');
    v_payment_type := COALESCE(p_booking->>'paymentType', p_booking->>'payment_type', 'advance');
    v_booked_by := COALESCE(p_booking->>'bookedBy', p_booking->>'booked_by', 'user');
    v_current_players := COALESCE((p_booking->>'currentPlayers')::INT, (p_booking->>'current_players')::INT, 1);
    v_sport := COALESCE(p_booking->>'sport', 'Box Cricket');

    -- Resource-Based Game Zone Validation & Price Derivation
    IF LOWER(v_sport) = 'game zone' OR LOWER(v_sport) = 'game_zone' OR v_resource_uuid IS NOT NULL THEN
        IF v_resource_uuid IS NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'RESOURCE_REQUIRED',
                'message', 'Please select a gaming station to proceed.'
            );
        END IF;

        -- Acquire lock for station reservation
        v_lock_key := hashtext(v_location_uuid::text || v_date::text || v_resource_uuid::text);
        PERFORM pg_advisory_xact_lock(v_lock_key);

        -- Fetch authoritative station record
        SELECT price, status, max_players, location_id INTO v_res_price, v_res_status, v_res_max_players, v_res_location_id
        FROM public.game_zone_resources
        WHERE id = v_resource_uuid;

        IF v_res_status IS NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'RESOURCE_NOT_FOUND',
                'message', 'Selected gaming station does not exist.'
            );
        END IF;

        IF v_res_location_id <> v_location_uuid THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'INVALID_LOCATION',
                'message', 'Selected station does not belong to this gaming center.'
            );
        END IF;

        IF v_res_status <> 'ACTIVE' THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'RESOURCE_INACTIVE',
                'message', 'This station is currently ' || LOWER(v_res_status) || ' and unavailable for booking.'
            );
        END IF;

        -- Authoritatively derive max_players and use client-passed prices if provided, else fallback to station price
        v_max_players := v_res_max_players;
        v_amount := COALESCE((p_booking->>'amount')::NUMERIC, ROUND(COALESCE(v_res_price, 200.00) * v_duration, 2));
        v_advance_price := COALESCE((p_booking->>'advance_price')::NUMERIC, (p_booking->>'advancePrice')::NUMERIC, ROUND(v_amount * 0.30, 2));

        IF v_payment_type = 'full' THEN
            v_advance_paid := v_amount;
        ELSE
            v_advance_paid := COALESCE((p_booking->>'advancePaid')::NUMERIC, (p_booking->>'advance_paid')::NUMERIC, v_advance_price);
        END IF;

        IF v_current_players > v_max_players THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'EXCEEDS_MAX_PLAYERS',
                'message', 'Player count exceeds station limit of ' || v_max_players
            );
        END IF;

        -- Check overlapping station bookings
        SELECT COUNT(*) INTO v_overlapping_count
        FROM public.bookings
        WHERE resource_id = v_resource_uuid
          AND date = v_date
          AND status IN ('booked', 'approved', 'pending')
          AND start_hour < v_end_hour
          AND end_hour > v_start_hour;

        IF v_overlapping_count > 0 THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'STATION_BOOKED',
                'message', 'This gaming station is already booked for the selected time slot.'
            );
        END IF;

        -- Check blockouts
        SELECT COUNT(*) INTO v_blockout_count
        FROM public.game_zone_blockouts
        WHERE resource_id = v_resource_uuid
          AND start_time < (v_date + (v_end_hour || ' hours')::INTERVAL)
          AND end_time > (v_date + (v_start_hour || ' hours')::INTERVAL);

        IF v_blockout_count > 0 THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'STATION_BLOCKED',
                'message', 'This station is blocked for maintenance or private event at the selected time.'
            );
        END IF;

        -- Force Game Zone rules: no matchmaking/challenge
        v_is_joinable := false;
        v_sport := 'Game Zone';

    -- Capacity-Based Validation (Swimming)
    ELSIF LOWER(v_sport) = 'swimming' THEN
        v_lock_key := hashtext(v_location_uuid::text || v_date::text || 'swimming_capacity');
        PERFORM pg_advisory_xact_lock(v_lock_key);

        SELECT COALESCE(max_capacity, 50) INTO v_max_capacity
        FROM public.locations
        WHERE id = v_location_uuid;

        IF v_max_capacity IS NULL THEN
            v_max_capacity := 50;
        END IF;

        SELECT COALESCE(SUM(current_players), 0) INTO v_current_total
        FROM public.bookings
        WHERE location_id = v_location_uuid
          AND date = v_date
          AND status IN ('booked', 'approved', 'pending')
          AND start_hour < v_end_hour
          AND end_hour > v_start_hour;

        IF (v_current_total + v_current_players) > v_max_capacity THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'CAPACITY_EXCEEDED',
                'message', 'Slot capacity exceeded. Available slots: ' || GREATEST(0, (v_max_capacity - v_current_total))
            );
        END IF;

        v_amount := COALESCE((p_booking->>'amount')::NUMERIC, 0);
        v_advance_paid := COALESCE((p_booking->>'advancePaid')::NUMERIC, (p_booking->>'advance_paid')::NUMERIC, 0);
        v_advance_price := COALESCE((p_booking->>'advance_price')::NUMERIC, 0);
        v_max_players := 50;
        v_is_joinable := false;

    -- Court-Based Validation (Cricket, Football, Tennis, Badminton, Basketball, Pickleball)
    ELSE
        v_lock_key := hashtext(v_location_uuid::text || v_date::text || COALESCE(v_court_uuid::text, 'court_default'));
        PERFORM pg_advisory_xact_lock(v_lock_key);

        SELECT COUNT(*) INTO v_overlapping_count
        FROM public.bookings
        WHERE location_id = v_location_uuid
          AND (v_court_uuid IS NULL OR court_id = v_court_uuid OR court_id IS NULL)
          AND date = v_date
          AND status IN ('booked', 'approved', 'pending')
          AND start_hour < v_end_hour
          AND end_hour > v_start_hour;

        IF v_overlapping_count > 0 THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'SLOT_TAKEN',
                'message', 'This time slot is already booked on the selected court.'
            );
        END IF;

        v_amount := COALESCE((p_booking->>'amount')::NUMERIC, 0);
        v_advance_paid := COALESCE((p_booking->>'advancePaid')::NUMERIC, (p_booking->>'advance_paid')::NUMERIC, 0);
        v_advance_price := COALESCE((p_booking->>'advance_price')::NUMERIC, 0);
        v_is_joinable := COALESCE((p_booking->>'isJoinable')::BOOLEAN, (p_booking->>'is_joinable')::BOOLEAN, false);
        v_max_players := COALESCE((p_booking->>'maxPlayers')::INT, (p_booking->>'max_players')::INT, 10);
    END IF;

    -- Generate UUID for booking
    v_booking_id := gen_random_uuid();

    -- Insert booking atomically
    INSERT INTO public.bookings (
        id, name, phone, date, location_id, court_id, resource_id, platform_id,
        game_id, selected_game, slot_id, slot_time, start_hour, end_hour,
        duration, amount, advance_paid, advance_price, status, payment_method,
        payment_type, checked_in, created_at, booked_by, is_joinable,
        max_players, current_players, sport, user_id
    ) VALUES (
        v_booking_id, v_name, v_phone, v_date, v_location_uuid, v_court_uuid, v_resource_uuid, v_platform_uuid,
        v_game_uuid, v_selected_game, v_slot_id, v_slot_time, v_start_hour, v_end_hour,
        v_duration, v_amount, v_advance_paid, v_advance_price, v_status, v_payment_method,
        v_payment_type, false, NOW(), v_booked_by, v_is_joinable,
        v_max_players, v_current_players, v_sport, v_user_uuid
    ) RETURNING * INTO v_new_booking;

    RETURN jsonb_build_object(
        'success', true,
        'booking', to_jsonb(v_new_booking)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_booking_atomic TO public, authenticated, anon, service_role;
