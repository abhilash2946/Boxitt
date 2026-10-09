-- =============================================================================
-- MIGRATION 007: Notification auto-delete aligned to slot completion
-- Description: Expire notifications 2 hours after session end when slot metadata exists.
-- =============================================================================

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS auto_delete_at TIMESTAMPTZ;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS data JSONB;

CREATE INDEX IF NOT EXISTS idx_notifications_auto_delete_at
  ON public.notifications(auto_delete_at);

CREATE OR REPLACE FUNCTION public.set_notification_auto_delete_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  notif_date TEXT;
  notif_slot_time TEXT;
  notif_start_hour DOUBLE PRECISION;
  notif_end_hour DOUBLE PRECISION;
  session_end_at TIMESTAMPTZ;
BEGIN
  notif_date := COALESCE(
    NULLIF(NEW.data->>'date', ''),
    NULLIF(NEW.data->>'booking_date', ''),
    NULLIF(NEW.data->>'challenge_date', '')
  );

  notif_slot_time := COALESCE(
    NULLIF(NEW.data->>'slot_time', ''),
    NULLIF(NEW.data->>'booking_slot_time', '')
  );

  IF COALESCE(NEW.data->>'start_hour', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN
    notif_start_hour := (NEW.data->>'start_hour')::DOUBLE PRECISION;
  ELSE
    notif_start_hour := NULL;
  END IF;

  IF COALESCE(NEW.data->>'end_hour', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN
    notif_end_hour := (NEW.data->>'end_hour')::DOUBLE PRECISION;
  ELSE
    notif_end_hour := NULL;
  END IF;

  session_end_at := public.compute_session_end_at(notif_date, notif_slot_time, notif_start_hour, notif_end_hour);

  IF session_end_at IS NOT NULL THEN
    NEW.auto_delete_at := session_end_at + INTERVAL '24 hours';
  ELSIF NEW.auto_delete_at IS NULL THEN
    -- Fallback for notifications without slot metadata.
    NEW.auto_delete_at := COALESCE(NEW.created_at, NOW()) + INTERVAL '24 hours';
  END IF;

  RETURN NEW;
END;
$function$;

UPDATE public.notifications n
SET auto_delete_at = computed.session_end_at + INTERVAL '24 hours'
FROM (
  SELECT
    id,
    public.compute_session_end_at(
      COALESCE(NULLIF(data->>'date', ''), NULLIF(data->>'booking_date', ''), NULLIF(data->>'challenge_date', '')),
      COALESCE(NULLIF(data->>'slot_time', ''), NULLIF(data->>'booking_slot_time', '')),
      CASE
        WHEN COALESCE(data->>'start_hour', '') ~ '^-?[0-9]+(\.[0-9]+)?$'
          THEN (data->>'start_hour')::DOUBLE PRECISION
        ELSE NULL
      END,
      CASE
        WHEN COALESCE(data->>'end_hour', '') ~ '^-?[0-9]+(\.[0-9]+)?$'
          THEN (data->>'end_hour')::DOUBLE PRECISION
        ELSE NULL
      END
    ) AS session_end_at
  FROM public.notifications
) AS computed
WHERE n.id = computed.id
  AND computed.session_end_at IS NOT NULL;

-- Fallback: For notifications missing slot metadata, set auto_delete_at to 24 hours after created_at
UPDATE public.notifications
SET auto_delete_at = created_at + INTERVAL '24 hours'
WHERE auto_delete_at IS NULL;
