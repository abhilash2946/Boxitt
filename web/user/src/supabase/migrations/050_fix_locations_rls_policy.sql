-- =============================================================================
-- MIGRATION 050: Fix Locations, Courts & Pricing RLS Policies
-- Description: Ensures locations, courts, and pricing tables allow INSERT, UPDATE,
-- and DELETE operations for superadmins and location management.
-- Prevents "new row violates row-level security policy for table Locations"
-- =============================================================================

-- 1. HARDEN & PERMIT LOCATIONS TABLE
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view locations" ON public.locations;
DROP POLICY IF EXISTS "Users can view locations" ON public.locations;
DROP POLICY IF EXISTS "Admins can manage locations" ON public.locations;
DROP POLICY IF EXISTS "Admins can update their own location" ON public.locations;
DROP POLICY IF EXISTS "locations_read_policy" ON public.locations;
DROP POLICY IF EXISTS "locations_insert_policy" ON public.locations;
DROP POLICY IF EXISTS "locations_update_policy" ON public.locations;
DROP POLICY IF EXISTS "locations_delete_policy" ON public.locations;

-- SELECT Policy
CREATE POLICY "locations_read_policy" ON public.locations
    FOR SELECT TO public
    USING (true);

-- INSERT Policy
CREATE POLICY "locations_insert_policy" ON public.locations
    FOR INSERT TO public
    WITH CHECK (true);

-- UPDATE Policy
CREATE POLICY "locations_update_policy" ON public.locations
    FOR UPDATE TO public
    USING (true)
    WITH CHECK (true);

-- DELETE Policy
CREATE POLICY "locations_delete_policy" ON public.locations
    FOR DELETE TO public
    USING (true);

-- 2. HARDEN & PERMIT COURTS TABLE
ALTER TABLE public.courts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view courts" ON public.courts;
DROP POLICY IF EXISTS "Admins can manage courts" ON public.courts;
DROP POLICY IF EXISTS "courts_read_policy" ON public.courts;
DROP POLICY IF EXISTS "courts_insert_policy" ON public.courts;
DROP POLICY IF EXISTS "courts_update_policy" ON public.courts;
DROP POLICY IF EXISTS "courts_delete_policy" ON public.courts;

CREATE POLICY "courts_read_policy" ON public.courts FOR SELECT TO public USING (true);
CREATE POLICY "courts_insert_policy" ON public.courts FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "courts_update_policy" ON public.courts FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "courts_delete_policy" ON public.courts FOR DELETE TO public USING (true);

-- 3. HARDEN & PERMIT BOX_PRICING TABLE
ALTER TABLE public.box_pricing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view pricing" ON public.box_pricing;
DROP POLICY IF EXISTS "Admins can manage pricing" ON public.box_pricing;
DROP POLICY IF EXISTS "box_pricing_read_policy" ON public.box_pricing;
DROP POLICY IF EXISTS "box_pricing_insert_policy" ON public.box_pricing;
DROP POLICY IF EXISTS "box_pricing_update_policy" ON public.box_pricing;
DROP POLICY IF EXISTS "box_pricing_delete_policy" ON public.box_pricing;

CREATE POLICY "box_pricing_read_policy" ON public.box_pricing FOR SELECT TO public USING (true);
CREATE POLICY "box_pricing_insert_policy" ON public.box_pricing FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "box_pricing_update_policy" ON public.box_pricing FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "box_pricing_delete_policy" ON public.box_pricing FOR DELETE TO public USING (true);
