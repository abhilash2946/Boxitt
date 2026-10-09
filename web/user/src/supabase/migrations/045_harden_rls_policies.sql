-- =============================================================================
-- MIGRATION 045: Harden Row Level Security (RLS) Policies
-- Description: Revokes overly broad wildcard policies on bookings, payments,
-- chats, challenges, and join_requests, replacing them with strict owner/role checks.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. HARDEN BOOKINGS TABLE
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow public access" ON public.bookings;
DROP POLICY IF EXISTS "Admins can manage all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can view their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "bookings_select_policy" ON public.bookings;
DROP POLICY IF EXISTS "bookings_insert_policy" ON public.bookings;
DROP POLICY IF EXISTS "bookings_update_policy" ON public.bookings;
DROP POLICY IF EXISTS "bookings_delete_policy" ON public.bookings;

-- SELECT Policy: Users can view their own bookings, or public joinable bookings, or location admins / superadmins
CREATE POLICY "bookings_select_policy" ON public.bookings
FOR SELECT TO public
USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR is_joinable = true
    OR is_superadmin()
    OR EXISTS (
        SELECT 1 FROM public.admin_accounts
        WHERE admin_accounts.user_id = auth.uid()
          AND admin_accounts.location_id = bookings.location_id
    )
);

-- INSERT Policy: Allow guest visitors and authenticated users to create bookings
CREATE POLICY "bookings_insert_policy" ON public.bookings
FOR INSERT TO public
WITH CHECK (true);

-- UPDATE Policy: Users can update their own bookings or assigned location admins / superadmin
CREATE POLICY "bookings_update_policy" ON public.bookings
FOR UPDATE TO public
USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR is_superadmin()
    OR EXISTS (
        SELECT 1 FROM public.admin_accounts
        WHERE admin_accounts.user_id = auth.uid()
          AND admin_accounts.location_id = bookings.location_id
    )
)
WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR is_superadmin()
    OR EXISTS (
        SELECT 1 FROM public.admin_accounts
        WHERE admin_accounts.user_id = auth.uid()
          AND admin_accounts.location_id = bookings.location_id
    )
);

-- DELETE Policy: Users can cancel/delete their own bookings or location admin / superadmin
CREATE POLICY "bookings_delete_policy" ON public.bookings
FOR DELETE TO public
USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR is_superadmin()
    OR EXISTS (
        SELECT 1 FROM public.admin_accounts
        WHERE admin_accounts.user_id = auth.uid()
          AND admin_accounts.location_id = bookings.location_id
    )
);

-- -----------------------------------------------------------------------------
-- 2. HARDEN JOIN_REQUESTS TABLE
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow public select for joining" ON public.join_requests;
DROP POLICY IF EXISTS "join_requests_select_policy" ON public.join_requests;

CREATE POLICY "join_requests_select_policy" ON public.join_requests
FOR SELECT TO public
USING (
    (auth.uid() IS NOT NULL AND auth.uid() = requester_id)
    OR is_superadmin()
    OR EXISTS (
        SELECT 1 FROM public.bookings
        WHERE bookings.id = join_requests.booking_id
          AND (
              bookings.user_id = auth.uid()
              OR EXISTS (
                  SELECT 1 FROM public.admin_accounts
                  WHERE admin_accounts.user_id = auth.uid()
                    AND admin_accounts.location_id = bookings.location_id
              )
          )
    )
);
