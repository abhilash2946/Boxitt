-- Migration 059: Auto Payments Ledger Trigger & Backfill
-- Description: Ensures all bookings always have corresponding payment records in the payments table,
-- enabling strict single-table payment tracking across normal, challenge, and joinable booking flows.

-- 1. Backfill missing advance/full payments for existing bookings
INSERT INTO public.payments (
    id,
    booking_id,
    user_id,
    amount,
    payment_type,
    payment_method,
    status,
    created_at
)
SELECT
    gen_random_uuid(),
    b.id,
    COALESCE(b.user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    b.advance_paid,
    CASE WHEN b.payment_type = 'full' OR b.advance_paid >= b.amount THEN 'full' ELSE 'advance' END,
    COALESCE(b.payment_method, 'online'),
    'success',
    b.created_at
FROM public.bookings b
WHERE b.advance_paid > 0
  AND NOT EXISTS (
      SELECT 1
      FROM public.payments p
      WHERE p.booking_id = b.id
        AND p.payment_type IN ('advance', 'full')
  );

-- 2. Trigger Function to automatically insert payment row on new bookings
CREATE OR REPLACE FUNCTION public.fn_sync_booking_payment_ledger()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.advance_paid > 0 THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.payments
            WHERE booking_id = NEW.id
              AND payment_type IN ('advance', 'full')
        ) THEN
            INSERT INTO public.payments (
                id,
                booking_id,
                user_id,
                amount,
                payment_type,
                payment_method,
                status,
                created_at
            ) VALUES (
                gen_random_uuid(),
                NEW.id,
                COALESCE(NEW.user_id, '00000000-0000-0000-0000-000000000000'::uuid),
                NEW.advance_paid,
                CASE WHEN NEW.payment_type = 'full' OR NEW.advance_paid >= NEW.amount THEN 'full' ELSE 'advance' END,
                COALESCE(NEW.payment_method, 'online'),
                'success',
                NOW()
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach Trigger to bookings table
DROP TRIGGER IF EXISTS trg_sync_booking_payment_ledger ON public.bookings;

CREATE TRIGGER trg_sync_booking_payment_ledger
AFTER INSERT ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_booking_payment_ledger();
