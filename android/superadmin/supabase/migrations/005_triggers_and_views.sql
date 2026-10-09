-- =============================================================================
-- MIGRATION 005: Triggers and Views
-- Description: Connecting functions to table events.
-- =============================================================================

-- =============================================================================
-- TRIGGER: on_auth_user_created
-- Description: Link auth.users to public profile management.
-- =============================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- TRIGGER: user_profile_audit_trigger
-- Description: Record IP and profile changes to the audit log.
-- =============================================================================
DROP TRIGGER IF EXISTS user_profile_audit_trigger ON public.user_profiles;
CREATE TRIGGER user_profile_audit_trigger
    AFTER INSERT OR UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.log_user_profile_changes();

-- =============================================================================
-- TRIGGER: update_rating_trigger
-- Description: Recalculate venue/user average rating.
-- =============================================================================
DROP TRIGGER IF EXISTS update_rating_trigger ON public.reviews;
CREATE TRIGGER update_rating_trigger
    AFTER INSERT OR DELETE OR UPDATE ON public.reviews
    FOR EACH ROW EXECUTE FUNCTION public.update_average_rating();

-- =============================================================================
-- TRIGGER: set_matchmaking_auto_delete_at
-- Description: Manage the lifecycle of challenges and joinable matches.
-- =============================================================================
DROP TRIGGER IF EXISTS trg_challenges_set_auto_delete_at ON public.challenges;
CREATE TRIGGER trg_challenges_set_auto_delete_at
    BEFORE INSERT OR UPDATE ON public.challenges
    FOR EACH ROW EXECUTE FUNCTION public.set_matchmaking_auto_delete_at();

-- =============================================================================
-- TRIGGER: set_notification_auto_delete_at
-- Description: Cleanup old notifications.
-- =============================================================================
DROP TRIGGER IF EXISTS trg_notifications_set_auto_delete_at ON public.notifications;
CREATE TRIGGER trg_notifications_set_auto_delete_at
    BEFORE INSERT OR UPDATE ON public.notifications
    FOR EACH ROW EXECUTE FUNCTION public.set_notification_auto_delete_at();

-- =============================================================================
-- TRIGGER: update_locations_updated_at
-- Description: Update timestamp.
-- =============================================================================
DROP TRIGGER IF EXISTS update_locations_updated_at ON public.locations;
CREATE TRIGGER update_locations_updated_at
    BEFORE UPDATE ON public.locations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
