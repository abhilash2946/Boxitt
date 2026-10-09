-- =============================================================================
-- MIGRATION 022: Add Auto-Delete Trigger to Bookings
-- Description: Automatically sets auto_delete_at for bookings to ensure joinable
--              matches and related join requests are cleaned up correctly.
-- =============================================================================

-- 1. Create a trigger function for bookings
CREATE OR REPLACE FUNCTION public.set_booking_auto_delete_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  session_end_at TIMESTAMPTZ;
BEGIN
  -- Compute session end time based on date and slot details
  session_end_at := public.compute_session_end_at(NEW.date, NEW.slot_time, NEW.start_hour, NEW.end_hour);

  IF session_end_at IS NOT NULL THEN
    -- Align with challenges: remove 1 hour after session ends
    NEW.auto_delete_at := session_end_at + INTERVAL '1 hour';
  ELSE
    -- Fallback: If no slot data, keep for 24 hours from creation
    NEW.auto_delete_at := COALESCE(NEW.created_at, NOW()) + INTERVAL '24 hours';
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Apply trigger to bookings table
DROP TRIGGER IF EXISTS trg_bookings_set_auto_delete_at ON public.bookings;
CREATE TRIGGER trg_bookings_set_auto_delete_at
    BEFORE INSERT OR UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.set_booking_auto_delete_at();

-- 3. Backfill existing bookings that have NULL auto_delete_at
UPDATE public.bookings
SET auto_delete_at = computed.session_end_at + INTERVAL '1 hour'
FROM (
  SELECT
    id,
    public.compute_session_end_at(date, slot_time, start_hour, end_hour) as session_end_at
  FROM public.bookings
  WHERE auto_delete_at IS NULL
) AS computed
WHERE public.bookings.id = computed.id
  AND computed.session_end_at IS NOT NULL;
