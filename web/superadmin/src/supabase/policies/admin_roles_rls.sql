-- Admin role policies

-- Allow superadmins to update any user profile (including role changes)
DROP POLICY IF EXISTS "user_profiles_update_superadmin" ON user_profiles;
CREATE POLICY "user_profiles_update_superadmin" ON user_profiles
  FOR UPDATE
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- Allow superadmins to read all profiles (explicit)
DROP POLICY IF EXISTS "user_profiles_read_superadmin" ON user_profiles;
CREATE POLICY "user_profiles_read_superadmin" ON user_profiles
  FOR SELECT
  USING (public.is_superadmin());

-- Enhanced security: Prevent users from changing their own role unless they are superadmin
DROP POLICY IF EXISTS "user_profiles_no_self_role_change" ON user_profiles;
CREATE POLICY "user_profiles_no_self_role_change" ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    (
      public.is_superadmin() OR
      role = (SELECT role FROM user_profiles WHERE id = auth.uid())
    )
  );
