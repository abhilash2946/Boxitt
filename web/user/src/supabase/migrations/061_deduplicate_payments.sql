-- Migration 061: Deduplicate Payment Ledger Entries
-- Description: Removes duplicate advance/full payment rows created for the same booking and user,
-- ensuring each booking has exactly one primary advance/full payment entry in the ledger.

DELETE FROM public.payments p1
USING public.payments p2
WHERE p1.id > p2.id
  AND p1.booking_id = p2.booking_id
  AND COALESCE(p1.user_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(p2.user_id, '00000000-0000-0000-0000-000000000000'::uuid)
  AND p1.payment_type IN ('advance', 'full')
  AND p2.payment_type IN ('advance', 'full')
  AND p1.amount = p2.amount;
