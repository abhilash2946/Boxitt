-- =============================================================================
-- MIGRATION 046: Atomic Booking Slot Reservation RPC
-- Description: Server-authoritative atomic slot reservation function using advisory locks.
-- Prevents client-side double-booking race conditions and capacity oversubscription.
-- =============================================================================

CREATE OR REPLACE FUNCTION create_booking_atomic(
    p_name VARCHAR,
    p_phone VARCHAR,
    p_date DATE,
    p_location_id UUID,
    p_court_id UUID DEFAULT NULL,
    p_slot_id VARCHAR DEFAULT NULL,
    p_slot_time VARCHAR DEFAULT NULL,
    p_start_hour NUMERIC DEFAULT 0,
    p_end_hour NUMERIC DEFAULT 1,
    p_duration NUMERIC DEFAULT 1,
    p_amount NUMERIC DEFAULT 0,
    p_advance_paid NUMERIC DEFAULT 0,
    p_advance_price NUMERIC DEFAULT 0,
    p_status VARCHAR DEFAULT 'booked',
    p_payment_method VARCHAR DEFAULT 'online',
    p_payment_type VARCHAR DEFAULT 'advance',
    p_booked_by VARCHAR DEFAULT 'user',
    p_is_joinable BOOLEAN DEFAULT FALSE,
    p_max_players INT DEFAULT 1,
    p_current_players INT DEFAULT 1,
    p_sport VARCHAR DEFAULT 'Box Cricket',
    p_user_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lock_key BIGINT;
    v_overlapping_count INT;
    v_max_capacity INT;
    v_current_total INT;
    v_new_booking public.bookings%ROWTYPE;
    v_booking_id UUID;
BEGIN
    -- Derive a numeric lock key from location, date, and court
    v_lock_key := hashtext(p_location_id::text || p_date::text || COALESCE(p_court_id::text, 'default_court'));

    -- Acquire transaction-level advisory lock (automatically released at commit/rollback)
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- Check if sport is capacity-based (e.g. Swimming)
    IF LOWER(p_sport) = 'swimming' THEN
        -- Capacity-based validation
        SELECT COALESCE(max_capacity, 30) INTO v_max_capacity
        FROM public.locations
        WHERE id = p_location_id;

        IF v_max_capacity IS NULL THEN
            v_max_capacity := 30;
        END IF;

        -- Sum existing tickets for overlapping slots
        SELECT COALESCE(SUM(current_players), 0) INTO v_current_total
        FROM public.bookings
        WHERE location_id = p_location_id
          AND date = p_date
          AND status IN ('booked', 'approved', 'pending')
          AND start_hour < p_end_hour
          AND end_hour > p_start_hour;

        IF (v_current_total + p_current_players) > v_max_capacity THEN
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
        WHERE location_id = p_location_id
          AND (p_court_id IS NULL OR court_id = p_court_id OR court_id IS NULL)
          AND date = p_date
          AND status IN ('booked', 'approved', 'pending')
          AND start_hour < p_end_hour
          AND end_hour > p_start_hour;

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
        v_booking_id, p_name, p_phone, p_date, p_location_id, p_court_id, p_slot_id, p_slot_time,
        p_start_hour, p_end_hour, p_duration, p_amount, p_advance_paid, p_advance_price,
        p_status, p_payment_method, p_payment_type, false, NOW(),
        p_booked_by, p_is_joinable, p_max_players, p_current_players, p_sport, p_user_id
    ) RETURNING * INTO v_new_booking;

    RETURN jsonb_build_object(
        'success', true,
        'booking', to_jsonb(v_new_booking)
    );
END;
$$;
