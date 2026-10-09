-- =============================================================================
-- MIGRATION 006: Views and Indexes
-- Description: Performance optimization and extra views.
-- =============================================================================

-- =============================================================================
-- INDEXES: Performance Tuning
-- =============================================================================

-- Locations
CREATE INDEX IF NOT EXISTS idx_locations_name ON public.locations(name);
CREATE INDEX IF NOT EXISTS idx_locations_city ON public.locations(city);

-- Users & Profiles
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON public.user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_user_profiles_id ON public.user_profiles(id);

-- Bookings
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_location_id ON public.bookings(location_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON public.bookings(date);

-- Challenges
CREATE INDEX IF NOT EXISTS idx_challenges_challenger_id ON public.challenges(challenger_id);
CREATE INDEX IF NOT EXISTS idx_challenges_target_id ON public.challenges(target_id);

-- Reviews
CREATE INDEX IF NOT EXISTS idx_reviews_location_id ON public.reviews(location_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON public.reviews(user_id);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read) WHERE NOT is_read;

-- Audit Logs
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at);
