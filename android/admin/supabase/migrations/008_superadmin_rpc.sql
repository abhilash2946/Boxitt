-- =============================================================================
-- MIGRATION 008: SuperAdmin Password RPC
-- Description: Securely update superadmin passwords bypassing RLS.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.change_super_admin_password(
    p_current_password TEXT,
    p_new_password TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_updated_count INTEGER;
    v_target_id UUID;
    v_user_email TEXT;
BEGIN
    -- 1. Try to find the master "superadmin" record first if password matches
    SELECT id INTO v_target_id
    FROM admin_accounts
    WHERE username ILIKE 'superadmin'
      AND password = p_current_password
    LIMIT 1;

    -- 2. If not found, try to find a personal superadmin record matching the current user's email
    IF v_target_id IS NULL THEN
        -- Get current user email from auth.jwt() if possible
        v_user_email := auth.jwt() ->> 'email';

        IF v_user_email IS NOT NULL THEN
            SELECT id INTO v_target_id
            FROM admin_accounts
            WHERE username ILIKE v_user_email
              AND is_superadmin = true
              AND password = p_current_password
            LIMIT 1;
        END IF;
    END IF;

    -- 3. If still not found, try ANY superadmin record that matches this password
    -- (This handles cases where the username might not be exactly 'superadmin' or email)
    IF v_target_id IS NULL THEN
        SELECT id INTO v_target_id
        FROM admin_accounts
        WHERE is_superadmin = true
          AND password = p_current_password
        LIMIT 1;
    END IF;

    -- 4. Perform the update if we found a target
    IF v_target_id IS NOT NULL THEN
        UPDATE admin_accounts
        SET password = p_new_password
        WHERE id = v_target_id;

        RETURN json_build_object('success', true, 'message', 'Password updated successfully');
    ELSE
        RETURN json_build_object('success', false, 'message', 'Invalid current password or no superadmin account found');
    END IF;
END;
$$;

-- RPC: update_admin_credentials
-- Specifically for superadmins to reset any arena admin's credentials
CREATE OR REPLACE FUNCTION public.update_admin_credentials(
    p_location_id UUID,
    p_new_username TEXT,
    p_new_password TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    -- Only allow if the caller is a superadmin
    IF NOT public.is_superadmin() THEN
        RETURN json_build_object('success', false, 'message', 'Unauthorized: Superadmin access required');
    END IF;

    UPDATE admin_accounts
    SET username = p_new_username,
        password = p_new_password
    WHERE location_id = p_location_id
      AND is_superadmin = false; -- Safety check to ensure we don't accidentally reset a superadmin here

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    IF v_updated_count > 0 THEN
        RETURN json_build_object('success', true, 'message', 'Admin credentials updated successfully');
    ELSE
        -- If no record found for that location, we might want to insert one,
        -- but based on your flow, the location should already have an admin.
        RETURN json_build_object('success', false, 'message', 'No admin account found for this location');
    END IF;
END;
$$;
