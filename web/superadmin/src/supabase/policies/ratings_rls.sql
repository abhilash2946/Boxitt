-- Ratings RLS Policies

-- Allow authenticated users to read all ratings (public data)
DROP POLICY IF EXISTS "ratings_read_all" ON ratings;
CREATE POLICY "ratings_read_all" ON ratings
  FOR SELECT
  USING (true);

-- Allow authenticated users to insert their own ratings
DROP POLICY IF EXISTS "ratings_insert_own" ON ratings;
CREATE POLICY "ratings_insert_own" ON ratings
  FOR INSERT
  WITH CHECK (auth.uid()::TEXT = user_id);

-- Allow users to update their own ratings
DROP POLICY IF EXISTS "ratings_update_own" ON ratings;
CREATE POLICY "ratings_update_own" ON ratings
  FOR UPDATE
  USING (auth.uid()::TEXT = user_id)
  WITH CHECK (auth.uid()::TEXT = user_id);

-- Allow users to delete their own ratings
DROP POLICY IF EXISTS "ratings_delete_own" ON ratings;
CREATE POLICY "ratings_delete_own" ON ratings
  FOR DELETE
  USING (auth.uid()::TEXT = user_id);

-- Allow superadmins to perform all operations
DROP POLICY IF EXISTS "ratings_admin_all" ON ratings;
CREATE POLICY "ratings_admin_all" ON ratings
  FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- Enhanced security: Restrict rating access
DROP POLICY IF EXISTS "ratings_secure_access" ON ratings;
CREATE POLICY "ratings_secure_access" ON ratings
  FOR ALL
  USING (
    auth.uid()::TEXT = user_id OR
    public.is_superadmin() OR
    (auth.role() = 'authenticated' AND (TG_OP = 'SELECT')) -- Allow authenticated users to read
  );
