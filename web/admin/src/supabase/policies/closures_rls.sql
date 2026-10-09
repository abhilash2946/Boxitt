-- Closures RLS Policies

-- Allow all authenticated users to read closures
DROP POLICY IF EXISTS "closures_read_all" ON closures;
CREATE POLICY "closures_read_all" ON closures
  FOR SELECT
  USING (true);

-- Allow admins to insert closures
DROP POLICY IF EXISTS "closures_insert_admin" ON closures;
CREATE POLICY "closures_insert_admin" ON closures
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role' OR
    public.is_admin()
  );

-- Allow admins to update closures
DROP POLICY IF EXISTS "closures_update_admin" ON closures;
CREATE POLICY "closures_update_admin" ON closures
  FOR UPDATE
  USING (
    auth.role() = 'service_role' OR
    public.is_admin()
  )
  WITH CHECK (
    auth.role() = 'service_role' OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "closures_delete_admin" ON closures;
-- Allow admins to delete closures
CREATE POLICY "closures_delete_admin" ON closures
  FOR DELETE
  USING (
    auth.role() = 'service_role' OR
    public.is_admin()
  );
