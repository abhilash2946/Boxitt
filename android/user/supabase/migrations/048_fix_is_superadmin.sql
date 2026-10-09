-- =============================================================================
-- MIGRATION 048: Fix is_superadmin and is_admin Functions
-- Description: Robustly checks user_profiles, user_roles, and admin_accounts
-- to ensure superadmin access checks succeed regardless of auth storage method.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_superadmin()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- 1. Check user_profiles
  IF EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'superadmin'
  ) THEN
    RETURN TRUE;
  END IF;

  -- 2. Check user_roles
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'superadmin' AND status = 'approved'
  ) THEN
    RETURN TRUE;
  END IF;

  -- 3. Check admin_accounts
  IF EXISTS (
    SELECT 1 FROM public.admin_accounts
    WHERE (user_id = auth.uid() OR username ILIKE 'superadmin') AND is_superadmin = true
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in is_superadmin(): %', SQLERRM;
    RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_superadmin() THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
  ) THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin') AND status = 'approved'
  ) THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.admin_accounts
    WHERE user_id = auth.uid()
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in is_admin(): %', SQLERRM;
    RETURN FALSE;
END;
$function$;
