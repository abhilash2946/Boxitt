-- =============================================================================
-- MIGRATION 002: Functions
-- Description: Complete business logic and RPC extraction.
-- =============================================================================

-- FUNCTION: compute_session_end_at
CREATE OR REPLACE FUNCTION public.compute_session_end_at(p_date text, p_slot_time text, p_start_hour double precision, p_end_hour double precision)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  base_date DATE;
  start_minutes INTEGER;
  end_minutes INTEGER;
  y INTEGER;
  m INTEGER;
  d INTEGER;
  hh INTEGER;
  mm INTEGER;
  ampm TEXT;
  end_part TEXT;
  time_match TEXT[];
BEGIN
  IF p_date IS NULL OR btrim(p_date) = '' THEN
    RETURN NULL;
  END IF;

  IF p_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
    base_date := p_date::DATE;
  ELSIF p_date ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' THEN
    d := split_part(p_date, '/', 1)::INTEGER;
    m := split_part(p_date, '/', 2)::INTEGER;
    y := split_part(p_date, '/', 3)::INTEGER;
    base_date := make_date(y, m, d);
  ELSE
    RETURN NULL;
  END IF;

  IF p_start_hour IS NOT NULL AND p_end_hour IS NOT NULL THEN
    start_minutes := round(p_start_hour * 60)::INTEGER;
    end_minutes := round(p_end_hour * 60)::INTEGER;
    IF end_minutes <= start_minutes THEN
      end_minutes := end_minutes + 24 * 60;
    END IF;
    RETURN (base_date::TIMESTAMPTZ + make_interval(mins => end_minutes));
  END IF;

  IF p_slot_time IS NULL OR btrim(p_slot_time) = '' THEN
    RETURN NULL;
  END IF;

  end_part := btrim(regexp_replace(p_slot_time, '^.*-', ''));
  IF end_part = '' THEN
    end_part := btrim(p_slot_time);
  END IF;

  time_match := regexp_match(end_part, '([0-9]{1,2})(?::([0-9]{2}))?[[:space:]]*(AM|PM)', 'i');
  IF time_match IS NULL THEN
    RETURN NULL;
  END IF;

  hh := time_match[1]::INTEGER;
  mm := COALESCE(NULLIF(time_match[2], ''), '0')::INTEGER;
  ampm := upper(time_match[3]);

  IF ampm = 'PM' AND hh < 12 THEN
    hh := hh + 12;
  ELSIF ampm = 'AM' AND hh = 12 THEN
    hh := 0;
  END IF;

  RETURN make_timestamptz(
    extract(year from base_date)::INTEGER,
    extract(month from base_date)::INTEGER,
    extract(day from base_date)::INTEGER,
    hh,
    mm,
    0
  );
END;
$function$;

-- FUNCTION: get_user_role
CREATE OR REPLACE FUNCTION public.get_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$function$;

-- FUNCTION: is_admin
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM user_profiles
  WHERE id = auth.uid();
  RETURN user_role IN ('admin', 'superadmin');
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in is_admin(): %', SQLERRM;
    RETURN FALSE;
END;
$function$;

-- FUNCTION: is_superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM user_profiles
  WHERE id = auth.uid();
  RETURN user_role = 'superadmin';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in is_superadmin(): %', SQLERRM;
    RETURN FALSE;
END;
$function$;

-- FUNCTION: handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_profiles (id, username, display_name, email, role, role_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    'user',
    'approved'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email;
  RETURN NEW;
END;
$function$;

-- FUNCTION: get_nearby_users
CREATE OR REPLACE FUNCTION public.get_nearby_users(lat double precision, lng double precision, radius_km double precision DEFAULT 5)
 RETURNS TABLE(id uuid, username text, display_name text, phone_number text, latitude double precision, longitude double precision, distance_km double precision)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    up.id,
    up.username,
    up.display_name,
    up.phone_number,
    up.latitude,
    up.longitude,
    (
      6371 * acos(
        cos(radians(lat)) * cos(radians(up.latitude)) * 
        cos(radians(up.longitude) - radians(lng)) + 
        sin(radians(lat)) * sin(radians(up.latitude))
      )
    ) AS distance_km
  FROM user_profiles up
  WHERE 
    up.latitude IS NOT NULL 
    AND up.longitude IS NOT NULL
    AND (
      6371 * acos(
        cos(radians(lat)) * cos(radians(up.latitude)) * 
        cos(radians(up.longitude) - radians(lng)) + 
        sin(radians(lat)) * sin(radians(up.latitude))
      )
    ) <= radius_km
  ORDER BY distance_km;
END;
$function$;

-- FUNCTION: accept_match_join_request
CREATE OR REPLACE FUNCTION public.accept_match_join_request(p_booking_id text, p_requester_id text, p_player_name text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_count integer DEFAULT 1)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_booking record;
  v_req record;
BEGIN
  SELECT id, user_id, current_players, max_players
  INTO v_booking
  FROM bookings
  WHERE id::text = p_booking_id::text
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;

  IF auth.uid()::text <> COALESCE(v_booking.user_id::text, '') THEN
    RAISE EXCEPTION 'Only host can accept request';
  END IF;

  SELECT * INTO v_req FROM join_requests
  WHERE booking_id = p_booking_id AND requester_id::text = p_requester_id AND status = 'pending'
  LIMIT 1 FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Pending request not found'; END IF;

  IF COALESCE(v_booking.current_players, 0) + v_req.group_size > COALESCE(v_booking.max_players, 0) THEN
    RAISE EXCEPTION 'Not enough spots available';
  END IF;

  UPDATE join_requests SET status = 'accepted', accepted_at = NOW() WHERE id = v_req.id;
  UPDATE bookings SET current_players = COALESCE(current_players, 0) + v_req.group_size WHERE id = p_booking_id;

  RETURN true;
END;
$function$;

-- FUNCTION: log_user_profile_changes
CREATE OR REPLACE FUNCTION public.log_user_profile_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ip_text TEXT;
  client_ip INET;
BEGIN
  BEGIN
    ip_text := trim(split_part(current_setting('request.header.x-forwarded-for', true), ',', 1));
    IF ip_text IS NOT NULL AND ip_text != '' THEN
      client_ip := ip_text::INET;
    ELSE
      client_ip := NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    client_ip := NULL;
  END;

  IF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent)
    VALUES (
      NEW.id, 'UPDATE_PROFILE', TG_TABLE_NAME, NEW.id,
      jsonb_build_object('role', OLD.role, 'username', OLD.username, 'display_name', OLD.display_name),
      jsonb_build_object('role', NEW.role, 'username', NEW.username, 'display_name', NEW.display_name),
      client_ip, current_setting('request.header.user-agent', true)
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (user_id, action, table_name, record_id, new_values, ip_address, user_agent)
    VALUES (
      NEW.id, 'CREATE_PROFILE', TG_TABLE_NAME, NEW.id,
      jsonb_build_object('role', NEW.role, 'username', NEW.username, 'display_name', NEW.display_name),
      client_ip, current_setting('request.header.user-agent', true)
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;

-- FUNCTION: update_average_rating
CREATE OR REPLACE FUNCTION public.update_average_rating()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    UPDATE user_profiles
    SET average_rating = (SELECT AVG(rating) FROM reviews WHERE user_id = NEW.user_id),
        review_count = (SELECT COUNT(*) FROM reviews WHERE user_id = NEW.user_id)
    WHERE id = NEW.user_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE user_profiles
    SET average_rating = (SELECT AVG(rating) FROM reviews WHERE user_id = OLD.user_id),
        review_count = (SELECT COUNT(*) FROM reviews WHERE user_id = OLD.user_id)
    WHERE id = OLD.user_id;
    RETURN OLD;
  END IF;
END;
$function$;

-- FUNCTION: cleanup_expired_matchmaking
CREATE OR REPLACE FUNCTION public.cleanup_expired_matchmaking()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  removed INTEGER := 0;
  c1 INTEGER := 0;
  c2 INTEGER := 0;
  c3 INTEGER := 0;
BEGIN
  DELETE FROM notifications
  WHERE auto_delete_at IS NOT NULL
    AND auto_delete_at <= NOW();
  GET DIAGNOSTICS c3 = ROW_COUNT;

  DELETE FROM challenges
  WHERE auto_delete_at IS NOT NULL
    AND auto_delete_at <= NOW();
  GET DIAGNOSTICS c1 = ROW_COUNT;

  DELETE FROM join_requests
  WHERE booking_id IN (SELECT id FROM bookings WHERE auto_delete_at <= NOW());
  GET DIAGNOSTICS c2 = ROW_COUNT;

  removed := c1 + c2 + c3;
  RETURN removed;
END;
$function$;

-- FUNCTION: cancel_match_join_request
CREATE OR REPLACE FUNCTION public.cancel_match_join_request(p_booking_id text, p_requester_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid()::text <> p_requester_id::text THEN
    RAISE EXCEPTION 'Unauthorized requester';
  END IF;

  DELETE FROM join_requests
  WHERE booking_id = p_booking_id AND requester_id::text = p_requester_id;

  RETURN true;
END;
$function$;

-- FUNCTION: has_permission
CREATE OR REPLACE FUNCTION public.has_permission(required_role text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM user_profiles
  WHERE id = auth.uid();

  RETURN CASE required_role
    WHEN 'superadmin' THEN user_role = 'superadmin'
    WHEN 'admin' THEN user_role IN ('admin', 'superadmin')
    ELSE user_role IN ('user', 'admin', 'superadmin')
  END;
END;
$function$;

-- FUNCTION: is_location_admin
CREATE OR REPLACE FUNCTION public.is_location_admin(loc_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_admin();
$function$;

-- FUNCTION: send_match_join_request
CREATE OR REPLACE FUNCTION public.send_match_join_request(p_host_user_id uuid, p_requester_id uuid, p_booking_id uuid, p_username text, p_display_name text, p_phone_number text, p_avatar_url text, p_booking_name text, p_booking_date text, p_booking_slot_time text, p_group_size integer DEFAULT 1)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO notifications (user_id, title, message, is_read, type, created_at)
  VALUES (
    p_host_user_id, 'Match Join Request',
    p_username || ' requested to join your match on ' || p_booking_date,
    false, 'match_join_request',
    NOW()
  );
  INSERT INTO notifications (user_id, title, message, is_read, type, created_at)
  VALUES (
    p_requester_id, 'Match Request Sent',
    'Your request to join ' || p_booking_name || ' has been sent.',
    false, 'match_join_request_sent',
    NOW()
  );
  RETURN true;
END;
$function$;

-- FUNCTION: set_matchmaking_auto_delete_at
CREATE OR REPLACE FUNCTION public.set_matchmaking_auto_delete_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  session_end_at TIMESTAMPTZ;
BEGIN
  session_end_at := public.compute_session_end_at(NEW.date, NEW.slot_time, NEW.start_hour, NEW.end_hour);
  IF session_end_at IS NULL THEN
    NEW.auto_delete_at := NULL;
  ELSE
    -- Expired sessions are removed from the feed 1 hour after they end.
    NEW.auto_delete_at := session_end_at + INTERVAL '1 hour';
  END IF;
  RETURN NEW;
END;
$function$;

-- FUNCTION: set_notification_auto_delete_at
CREATE OR REPLACE FUNCTION public.set_notification_auto_delete_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.auto_delete_at IS NULL THEN
    NEW.auto_delete_at := NOW() + INTERVAL '24 hours';
  END IF;
  RETURN NEW;
END;
$function$;

-- FUNCTION: submit_match_join_request
CREATE OR REPLACE FUNCTION public.submit_match_join_request(p_booking_id text, p_requester_id text, p_player_name text, p_phone text, p_group_size integer DEFAULT 1, p_requester_details jsonb DEFAULT '{}'::jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid()::text <> p_requester_id::text THEN
    RAISE EXCEPTION 'Unauthorized requester';
  END IF;

  INSERT INTO join_requests (booking_id, requester_id, player_name, phone, group_size, requester_details, status)
  VALUES (p_booking_id, p_requester_id::uuid, p_player_name, p_phone, p_group_size, p_requester_details, 'pending');

  RETURN true;
END;
$function$;

-- FUNCTION: update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;
