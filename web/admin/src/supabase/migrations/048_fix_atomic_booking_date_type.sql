-- =============================================================================
-- MIGRATION 048: Fix Atomic Booking RPC Date Parameter Mismatch
-- Description: Changes internal RPC date variable to TEXT when querying public.bookings
-- where date column is stored as TEXT. Prevents "operator does not exist: text = date" error.
-- =============================================================================

-- Unambiguously drop any legacy function overloads
DROP FUNCTION IF EXISTS public.create_booking_atomic(jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.create_booking_atomic CASCADE;

CREATE OR REPLACE FUNCTION public.create_booking_atomic(p_booking JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_name TEXT;
    v_phone TEXT;
    v_date_str TEXT;
    v_date_val DATE;
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
    v_date_str := COALESCE(p_booking->>'date', p_booking->>'p_date');

    IF v_date_str IS NULL OR v_date_str = '' THEN
        v_date_str := TO_CHAR(NOW(), 'YYYY-MM-DD');
    END IF;

    BEGIN
        v_date_val := v_date_str::DATE;
    EXCEPTION WHEN OTHERS THEN
        v_date_val := CURRENT_DATE;
    END;

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
        v_lock_key := hashtext(v_location_uuid::text || v_date_str || v_resource_uuid::text);
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
          AND date = v_date_str
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
          AND start_time < (v_date_val + (v_end_hour || ' hours')::INTERVAL)
          AND end_time > (v_date_val + (v_start_hour || ' hours')::INTERVAL);

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
        v_lock_key := hashtext(v_location_uuid::text || v_date_str || 'swimming_capacity');
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
          AND date = v_date_str
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
        v_lock_key := hashtext(v_location_uuid::text || v_date_str || COALESCE(v_court_uuid::text, 'court_default'));
        PERFORM pg_advisory_xact_lock(v_lock_key);

        SELECT COUNT(*) INTO v_overlapping_count
        FROM public.bookings
        WHERE location_id = v_location_uuid
          AND (v_court_uuid IS NULL OR court_id = v_court_uuid OR court_id IS NULL)
          AND date = v_date_str
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
        v_booking_id, v_name, v_phone, v_date_str, v_location_uuid, v_court_uuid, v_resource_uuid, v_platform_uuid,
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
