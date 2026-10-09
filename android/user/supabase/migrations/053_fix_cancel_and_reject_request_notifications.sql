-- =============================================================================
-- MIGRATION 053: Fix cancel and reject request notification cleanup (SECURITY DEFINER)
-- Bypasses RLS to allow proper cleanup of notification records for both host and requester.
-- =============================================================================

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

  -- Delete from join_requests (for matches)
  DELETE FROM public.join_requests
  WHERE booking_id = p_booking_id AND requester_id::text = p_requester_id;

  -- Delete notification records for BOTH host and requester (bypasses RLS)
  DELETE FROM public.notifications
  WHERE (
    (data->>'booking_id' = p_booking_id OR data->>'challenge_id' = p_booking_id)
    AND (data->>'requester_id' = p_requester_id OR data->>'requesterId' = p_requester_id)
    AND (data->>'type' IN ('challenge_request', 'challenge_request_sent', 'match_join_request', 'match_join_request_sent'))
  );

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_challenge_request(p_challenge_id text, p_requester_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Delete notification records for BOTH host and requester (bypasses RLS)
  DELETE FROM public.notifications
  WHERE (
    (data->>'booking_id' = p_challenge_id OR data->>'challenge_id' = p_challenge_id)
    AND (data->>'requester_id' = p_requester_id OR data->>'requesterId' = p_requester_id)
    AND (data->>'type' IN ('challenge_request', 'challenge_request_sent', 'match_join_request', 'match_join_request_sent'))
  );

  RETURN true;
END;
$function$;
