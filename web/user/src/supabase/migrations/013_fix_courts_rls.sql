-- Migration 013: Add RLS policies for 'courts' table and fix missing courts

-- 1. Enable RLS on courts
ALTER TABLE public.courts ENABLE ROW LEVEL SECURITY;

-- 2. Add policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'courts' AND policyname = 'Admins can manage courts'
    ) THEN
        CREATE POLICY "Admins can manage courts" ON public.courts FOR ALL TO public USING (is_admin());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'courts' AND policyname = 'Public can view courts'
    ) THEN
        CREATE POLICY "Public can view courts" ON public.courts FOR SELECT TO public USING (true);
    END IF;
END
$$;

-- 3. Data Cleanup: Ensure all locations have at least one court (Court 1)
DO $$
DECLARE
    loc RECORD;
BEGIN
    FOR loc IN SELECT id FROM public.locations LOOP
        IF NOT EXISTS (SELECT 1 FROM public.courts WHERE location_id = loc.id AND court_number = 1) THEN
            INSERT INTO public.courts (location_id, court_number, name)
            VALUES (loc.id, 1, 'Court 1');
        END IF;
    END LOOP;
END $$;
