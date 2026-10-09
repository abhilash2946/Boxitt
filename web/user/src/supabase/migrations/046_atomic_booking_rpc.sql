-- =============================================================================
-- MIGRATION 046: Atomic Booking Slot Reservation RPC (JSONB Payload)
-- Description: Server-authoritative atomic slot reservation function using advisory locks.
-- Prevents client-side double-booking race conditions and capacity oversubscription.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_booking_atomic(p_booking JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_name TEXT;
    v_phone TEXT;
    v_date DATE;
    v_location_uuid UUID;
    v_court_uuid UUID;
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
    v_max_capacity INT;
    v_current_total INT;
    v_new_booking public.bookings%ROWTYPE;
    v_booking_id UUID;
BEGIN
    -- Extract values from JSONB payload safely
    v_name := COALESCE(p_booking->>'name', p_booking->>'p_name', 'Guest');
    v_phone := COALESCE(p_booking->>'phone', p_booking->>'p_phone', '0000000000');
    v_date := (COALESCE(p_booking->>'date', p_booking->>'p_date'))::DATE;
    v_location_uuid := (COALESCE(p_booking->>'locationId', p_booking->>'location_id', p_booking->>'p_location_id'))::UUID;

    IF p_booking->>'courtId' IS NOT NULL AND p_booking->>'courtId' <> '' THEN
        v_court_uuid := (p_booking->>'courtId')::UUID;
    ELSIF p_booking->>'court_id' IS NOT NULL AND p_booking->>'court_id' <> '' THEN
        v_court_uuid := (p_booking->>'court_id')::UUID;
    ELSIF p_booking->>'p_court_id' IS NOT NULL AND p_booking->>'p_court_id' <> '' THEN
        v_court_uuid := (p_booking->>'p_court_id')::UUID;
    ELSE
        v_court_uuid := NULL;
    END IF;

    IF p_booking->>'user_id' IS NOT NULL AND p_booking->>'user_id' <> '' THEN
        v_user_uuid := (p_booking->>'user_id')::UUID;
    ELSIF p_booking->>'p_user_id' IS NOT NULL AND p_booking->>'p_user_id' <> '' THEN
        v_user_uuid := (p_booking->>'p_user_id')::UUID;
    ELSE
        v_user_uuid := NULL;
    END IF;

    v_slot_id := COALESCE(p_booking->>'slotId', p_booking->>'slot_id', p_booking->>'p_slot_id');
    v_slot_time := COALESCE(p_booking->>'slotTime', p_booking->>'slot_time', p_booking->>'p_slot_time');
    v_start_hour := COALESCE((p_booking->>'startHour')::NUMERIC, (p_booking->>'start_hour')::NUMERIC, (p_booking->>'p_start_hour')::NUMERIC, 0);
    v_end_hour := COALESCE((p_booking->>'endHour')::NUMERIC, (p_booking->>'end_hour')::NUMERIC, (p_booking->>'p_end_hour')::NUMERIC, 1);
    v_duration := COALESCE((p_booking->>'duration')::NUMERIC, (p_booking->>'p_duration')::NUMERIC, 1);
    v_amount := COALESCE((p_booking->>'amount')::NUMERIC, (p_booking->>'p_amount')::NUMERIC, 0);
    v_advance_paid := COALESCE((p_booking->>'advancePaid')::NUMERIC, (p_booking->>'advance_paid')::NUMERIC, (p_booking->>'p_advance_paid')::NUMERIC, 0);
    v_advance_price := COALESCE((p_booking->>'advance_price')::NUMERIC, (p_booking->>'p_advance_price')::NUMERIC, 0);
    v_status := COALESCE(p_booking->>'status', p_booking->>'p_status', 'booked');
    v_payment_method := COALESCE(p_booking->>'paymentMethod', p_booking->>'payment_method', p_booking->>'p_payment_method', 'online');
    v_payment_type := COALESCE(p_booking->>'paymentType', p_booking->>'payment_type', p_booking->>'p_payment_type', 'advance');
    v_booked_by := COALESCE(p_booking->>'bookedBy', p_booking->>'booked_by', p_booking->>'p_booked_by', 'user');
    v_is_joinable := COALESCE((p_booking->>'isJoinable')::BOOLEAN, (p_booking->>'is_joinable')::BOOLEAN, (p_booking->>'p_is_joinable')::BOOLEAN, false);
    v_max_players := COALESCE((p_booking->>'maxPlayers')::INT, (p_booking->>'max_players')::INT, (p_booking->>'p_max_players')::INT, 1);
    v_current_players := COALESCE((p_booking->>'currentPlayers')::INT, (p_booking->>'current_players')::INT, (p_booking->>'p_current_players')::INT, 1);
    v_sport := COALESCE(p_booking->>'sport', p_booking->>'p_sport', 'Box Cricket');

    -- Derive a numeric lock key from location, date, and court
    v_lock_key := hashtext(v_location_uuid::text || v_date::text || COALESCE(v_court_uuid::text, 'default_court'));

    -- Acquire transaction-level advisory lock (automatically released at commit/rollback)
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- Check if sport is capacity-based (e.g. Swimming)
    IF LOWER(v_sport) = 'swimming' THEN
        -- Capacity-based validation
        SELECT COALESCE(max_capacity, 30) INTO v_max_capacity
        FROM public.locations
        WHERE id = v_location_uuid;

        IF v_max_capacity IS NULL THEN
            v_max_capacity := 30;
        END IF;

        -- Sum existing tickets for overlapping slots
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
    ELSE
        -- Court-based validation: Check for overlapping active bookings
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
    END IF;

    -- Generate UUID for booking
    v_booking_id := gen_random_uuid();

    -- Insert booking atomically
    INSERT INTO public.bookings (
        id, name, phone, date, location_id, court_id, slot_id, slot_time,
        start_hour, end_hour, duration, amount, advance_paid, advance_price,
        status, payment_method, payment_type, checked_in, created_at,
        booked_by, is_joinable, max_players, current_players, sport, user_id
    ) VALUES (
        v_booking_id, v_name, v_phone, v_date, v_location_uuid, v_court_uuid, v_slot_id, v_slot_time,
        v_start_hour, v_end_hour, v_duration, v_amount, v_advance_paid, v_advance_price,
        v_status, v_payment_method, v_payment_type, false, NOW(),
        v_booked_by, v_is_joinable, v_max_players, v_current_players, v_sport, v_user_uuid
    ) RETURNING * INTO v_new_booking;

    RETURN jsonb_build_object(
        'success', true,
        'booking', to_jsonb(v_new_booking)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_booking_atomic TO public, authenticated, anon, service_role;
