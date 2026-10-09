-- =============================================================================
-- MIGRATION 009: Admin Accounts Uniqueness
-- Description: Fixes the ON CONFLICT error on Web by adding a unique constraint.
-- =============================================================================

-- Ensure there is only one regular admin account per location
ALTER TABLE public.admin_accounts
ADD CONSTRAINT admin_accounts_location_id_key UNIQUE (location_id);
