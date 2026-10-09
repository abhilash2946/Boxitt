-- =============================================================================
-- MIGRATION 020: Fix Database Errors & Sync Users
-- Description: Ensures public.users manifest is in sync with auth.users to fix
--              foreign key violations in user_profiles and audit_log.
--              Also updates legacy role check functions to use the new user_roles table.
-- =============================================================================

-- 1. Create a helper to check if a user is an admin (any role except 'user')
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'superadmin')
    AND status = 'approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update legacy is_admin and is_superadmin functions to use the new architecture
-- This ensures that RLS policies in OLD projects (which use these functions)
-- correctly recognize the user's role from the new user_roles table.
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.check_is_admin();
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in is_admin(): %', SQLERRM;
    RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.check_is_superadmin();
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in is_superadmin(): %', SQLERRM;
    RETURN FALSE;
END;
$function$;

-- 3. Fix handle_new_user to ensure public.users exists before user_profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- MUST insert into public.users first to satisfy foreign key constraints
  -- in user_profiles, audit_log, and other tables.
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  -- Create the profile
  INSERT INTO public.user_profiles (id, username, display_name, email, role, role_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    'user',
    'approved'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email;

  RETURN NEW;
END;
$function$;

-- 4. Backfill public.users for any missing records to fix existing broken profiles
INSERT INTO public.users (id, email)
SELECT id, email FROM public.user_profiles
ON CONFLICT (id) DO NOTHING;

-- 5. Audit Log Safety: Ensure trigger doesn't fail if request context is weird
CREATE OR REPLACE FUNCTION public.log_user_profile_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ip_text TEXT;
  client_ip INET;
  ua_text TEXT;
BEGIN
  -- Safely get IP and UA
  BEGIN
    ip_text := trim(split_part(current_setting('request.header.x-forwarded-for', true), ',', 1));
    IF ip_text IS NOT NULL AND ip_text != '' AND ip_text ~ '^[0-9\.:]+$' THEN
      client_ip := ip_text::INET;
    ELSE
      client_ip := NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    client_ip := NULL;
  END;

  BEGIN
    ua_text := current_setting('request.header.user-agent', true);
  EXCEPTION WHEN OTHERS THEN
    ua_text := 'Unknown';
  END;

  IF TG_OP = 'UPDATE' THEN
    -- Ensure user exists in users table before logging (though backfill should have fixed it)
    INSERT INTO public.users (id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO audit_log (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent)
    VALUES (
      NEW.id, 'UPDATE_PROFILE', TG_TABLE_NAME, NEW.id,
      jsonb_build_object('role', OLD.role, 'username', OLD.username, 'display_name', OLD.display_name),
      jsonb_build_object('role', NEW.role, 'username', NEW.username, 'display_name', NEW.display_name),
      client_ip, ua_text
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.users (id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO audit_log (user_id, action, table_name, record_id, new_values, ip_address, user_agent)
    VALUES (
      NEW.id, 'CREATE_PROFILE', TG_TABLE_NAME, NEW.id,
      jsonb_build_object('role', NEW.role, 'username', NEW.username, 'display_name', NEW.display_name),
      client_ip, ua_text
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;
